create table public.saved_jobs (
  account_id uuid not null references public.accounts(id) on delete cascade,
  job_id text not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, job_id)
);
create table public.saved_searches (
  id text primary key default gen_random_uuid()::text,
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  filters jsonb not null check (jsonb_typeof(filters)='object'),
  alerts boolean not null default true,
  created_at timestamptz not null default now()
);
create index saved_jobs_account_idx on public.saved_jobs(account_id,created_at desc);
create index saved_searches_account_idx on public.saved_searches(account_id,created_at desc);
alter table public.saved_jobs enable row level security;
alter table public.saved_searches enable row level security;
create policy saved_jobs_read on public.saved_jobs for select using (private.is_active() and account_id=auth.uid());
create policy saved_searches_read on public.saved_searches for select using (private.is_active() and account_id=auth.uid());
revoke all on public.saved_jobs,public.saved_searches from anon,authenticated;
grant select on public.saved_jobs,public.saved_searches to anon,authenticated;

create function private.clean_job_filters(p jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare requested_department text; requested_property text; salary_min numeric; sort_by text;
begin
  if p is null or jsonb_typeof(p)<>'object' then raise exception 'HH: Invalid search filters.'; end if;
  requested_department:=private.text_value(p,'department',100);
  requested_property:=private.text_value(p,'propertyType',100);
  if requested_department<>'' and not exists(select 1 from private.hospitality_roles r where r.department=requested_department) then raise exception 'HH: Choose a valid department.'; end if;
  if requested_property<>'' and not exists(select 1 from private.hospitality_property_types where name=requested_property) then raise exception 'HH: Choose a valid property type.'; end if;
  salary_min:=private.number_value(p,'salaryMin');
  if mod(salary_min,1)<>0 then raise exception 'HH: Enter a valid minimum salary.'; end if;
  sort_by:=coalesce(nullif(private.text_value(p,'sort',20),''),'newest');
  if sort_by not in ('newest','salary') then raise exception 'HH: Invalid search sort.'; end if;
  return jsonb_build_object('q',private.text_value(p,'q',200),'city',private.text_value(p,'city',200),'department',requested_department,'propertyType',requested_property,'salaryMin',salary_min,'stay',private.bool_value(p,'stay'),'meals',private.bool_value(p,'meals'),'sort',sort_by);
end $$;

create or replace function public.workspace_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); actor public.accounts; company_list jsonb; job_list jsonb; application_list jsonb; profile jsonb; moderation jsonb; account_list jsonb; application_counts jsonb; saved_job_ids jsonb; saved_searches jsonb;
begin
  select * into actor from public.accounts where id=uid;
  if actor.suspended then return jsonb_build_object('role',actor.role,'userId',uid,'profile',null,'companies','[]'::jsonb,'jobs','[]'::jsonb,'applications','[]'::jsonb,'moderation','[]'::jsonb,'savedJobIds','[]'::jsonb,'savedSearches','[]'::jsonb,'suspended',true,'suspensionReason',actor.suspension_reason); end if;
  select data into profile from public.applicant_profiles where id=uid;
  select coalesce(jsonb_agg(private.company_json(c,c.owner_id=uid or actor.role='admin') order by c.created_at desc),'[]'::jsonb) into company_list from public.companies c where private.public_company(c.id) or c.owner_id=uid or actor.role='admin';
  select coalesce(jsonb_agg(
    private.job_json(j,case when c.owner_id=uid or actor.role='admin' or private.public_job(j.id) then coalesce(j.approved_version,j.working_version) else (select a.job_version from public.applications a where a.job_id=j.id and a.applicant_id=uid) end) ||
    case when (c.owner_id=uid or actor.role='admin') and j.approved_version is not null and j.working_version<>j.approved_version then jsonb_build_object('pendingRevision',private.job_json(j,j.working_version)) else '{}'::jsonb end
    order by j.created_at desc),'[]'::jsonb) into job_list from public.jobs j join public.companies c on c.id=j.company_id where private.public_job(j.id) or private.applied_to(j.id) or c.owner_id=uid or actor.role='admin';
  select coalesce(jsonb_agg(a.data||jsonb_build_object('id',a.id,'status',a.status) order by a.submitted_at desc),'[]'::jsonb) into application_list from public.applications a where actor.role='applicant' and a.applicant_id=uid;
  if actor.role='employer' then
    select coalesce(jsonb_object_agg(counts.job_id,jsonb_build_object('total',counts.total,'submitted',counts.submitted,'shortlisted',counts.shortlisted)),'{}'::jsonb) into application_counts from (
      select j.id as job_id,count(a.id) as total,count(a.id) filter(where a.status='submitted') as submitted,count(a.id) filter(where a.status='shortlisted') as shortlisted
      from public.jobs j join public.companies c on c.id=j.company_id left join public.applications a on a.job_id=j.id
      where c.owner_id=uid group by j.id
    ) counts;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'targetId',m.target_id,'action',m.action,'reason',m.reason,'at',m.created_at) order by m.created_at desc),'[]'::jsonb) into moderation from public.moderation_events m where actor.role='admin';
  if actor.role='admin' then
    select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'role',a.role,'name',coalesce(nullif(p.data->>'name',''),(select nullif(c.data->>'name','') from public.companies c where c.owner_id=a.id order by c.created_at limit 1),a.id::text),'suspended',a.suspended) order by a.created_at desc),'[]'::jsonb) into account_list from public.accounts a left join public.applicant_profiles p on p.id=a.id;
  end if;
  if uid is not null then
    select coalesce(jsonb_agg(job_id order by created_at desc),'[]'::jsonb) into saved_job_ids from public.saved_jobs where account_id=uid;
    select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'filters',s.filters,'alerts',s.alerts,'createdAt',s.created_at) order by s.created_at desc),'[]'::jsonb) into saved_searches from public.saved_searches s where s.account_id=uid;
  end if;
  return jsonb_build_object('role',actor.role,'userId',uid,'profile',profile,'companies',company_list,'jobs',job_list,'applications',application_list,'moderation',moderation,'savedJobIds',coalesce(saved_job_ids,'[]'::jsonb),'savedSearches',coalesce(saved_searches,'[]'::jsonb),'suspended',false)||case when actor.role='admin' then jsonb_build_object('accounts',account_list) when actor.role='employer' then jsonb_build_object('applicationCounts',application_counts) else '{}'::jsonb end;
end $$;

create or replace function public.workspace_action(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); actor public.accounts; company public.companies; job public.jobs; revision public.job_revisions; application public.applications; identifier text; target_status text; reason text; document jsonb; profile jsonb; answers jsonb; screening jsonb:='[]'; q jsonb; answer text; passed boolean; normalized_answers jsonb:='{}'; action_time timestamptz:=clock_timestamp(); new_version integer; search_name text; alerts_on boolean;
begin
  if uid is null then raise exception 'HH: Sign in to continue.'; end if;
  select * into actor from public.accounts where id=uid for share;
  if not found then raise exception 'HH: Your account is not ready. Sign in again.'; end if;
  if actor.suspended then raise exception 'HH: Your account is suspended.'; end if;
  if jsonb_typeof(payload)<>'object' or payload is null or octet_length(payload::text)>131072 then raise exception 'HH: Invalid request.'; end if;
  identifier:=private.text_value(payload,'id',100);

  if action='profile.save' then
    if actor.role<>'applicant' then raise exception 'HH: Applicant access is required.'; end if;
    document:=private.clean_profile(payload,uid);
    insert into public.applicant_profiles(id,data) values(uid,document) on conflict(id) do update set data=excluded.data,updated_at=action_time;

  elsif action='company.save' then
    if actor.role<>'employer' then raise exception 'HH: Employer access is required.'; end if;
    select * into company from public.companies where id=identifier for update;
    if found and company.owner_id<>uid then raise exception 'HH: You may only edit your own company.'; end if;
    if found and company.status='suspended' then raise exception 'HH: This company is suspended. Contact the administrator.'; end if;
    identifier:=coalesce(nullif(identifier,''),gen_random_uuid()::text);
    target_status:=case when payload->>'status'='draft' then 'draft' else 'pending' end;
    perform private.check_property(private.text_value(payload,'type',100));
    document:=jsonb_build_object('id',identifier,'ownerId',uid,'name',private.text_value(payload,'name',200),'type',private.text_value(payload,'type',100),'city',private.text_value(payload,'city',100),'address',private.text_value(payload,'address',1000),'phone',private.text_value(payload,'phone',30),'email',private.text_value(payload,'email',320),'website',private.text_value(payload,'website',1000),'description',private.text_value(payload,'description',10000),'status',target_status,'reviewReason','','initials',private.text_value(payload,'initials',5),'color',private.text_value(payload,'color',30));
    if target_status='pending' and not private.company_ready(document) then raise exception 'HH: Complete company name, property type, city, address, description, valid phone and email before submitting for review.'; end if;
    insert into public.companies(id,owner_id,status,data) values(identifier,uid,target_status,document-'address'-'phone'-'email') on conflict(id) do update set status=excluded.status,data=excluded.data,review_reason='',updated_at=action_time where public.companies.owner_id=uid;
    if not found then raise exception 'HH: You may only edit your own company.'; end if;
    insert into public.company_contacts(company_id,data) values(identifier,jsonb_build_object('address',document->>'address','phone',document->>'phone','email',document->>'email')) on conflict(company_id) do update set data=excluded.data;

  elsif action='job.save' then
    if actor.role<>'employer' then raise exception 'HH: Employer access is required.'; end if;
    select * into company from public.companies where id=private.text_value(payload,'companyId',100) for share;
    if not found or company.owner_id<>uid then raise exception 'HH: You may only post jobs for your own company.'; end if;
    if company.status='suspended' then raise exception 'HH: This company is suspended.'; end if;
    select * into job from public.jobs where id=identifier for update;
    if found and job.company_id<>company.id then raise exception 'HH: You may only edit jobs for their original company.'; end if;
    if found and job.removed then raise exception 'HH: This job was removed by an administrator.'; end if;
    if found and job.closed then raise exception 'HH: This job is closed. Create a new vacancy.'; end if;
    identifier:=coalesce(nullif(identifier,''),gen_random_uuid()::text);
    new_version:=coalesce(job.working_version,0)+1;
    target_status:=case when payload->>'status'='draft' then 'draft' else 'pending' end;
    document:=private.clean_job(payload,identifier,company.id,new_version,coalesce(job.created_at,action_time),target_status);
    insert into public.jobs(id,company_id,working_version,created_at) values(identifier,company.id,new_version,action_time) on conflict(id) do update set working_version=excluded.working_version where public.jobs.company_id=company.id;
    if not found then raise exception 'HH: You may only edit your own job.'; end if;
    insert into public.job_revisions(job_id,version,status,data) values(identifier,new_version,target_status,document);

  elsif action='job.close' then
    if actor.role<>'employer' then raise exception 'HH: Employer access is required.'; end if;
    select * into job from public.jobs where id=identifier for update;
    if not found or not private.owns_company(job.company_id) then raise exception 'HH: You may only close your own job.'; end if;
    update public.jobs set closed=true where id=identifier;

  elsif action='application.submit' then
    if actor.role<>'applicant' then raise exception 'HH: Applicant access is required.'; end if;
    select * into job from public.jobs where id=private.text_value(payload,'jobId',100) for share;
    if not found or not private.public_job(job.id) then raise exception 'HH: This job is no longer accepting applications.'; end if;
    select * into company from public.companies where id=job.company_id for share;
    perform 1 from public.accounts where id=company.owner_id and not suspended for share;
    if not found or company.status<>'approved' then raise exception 'HH: This employer is no longer accepting applications.'; end if;
    select data into profile from public.applicant_profiles where id=uid for share;
    if not private.profile_ready(profile) then raise exception 'HH: Complete your applicant profile before applying.'; end if;
    if exists(select 1 from public.applications where job_id=job.id and applicant_id=uid) then raise exception 'HH: You have already applied to this job.'; end if;
    select * into revision from public.job_revisions where job_id=job.id and version=job.approved_version;
    answers:=coalesce(payload->'answers','{}'::jsonb);
    if jsonb_typeof(answers)<>'object' then raise exception 'HH: Screening answers must be an object.'; end if;
    if exists(select 1 from jsonb_object_keys(answers) k where not exists(select 1 from jsonb_array_elements(revision.data->'questions') x where x->>'id'=k)) then raise exception 'HH: Unknown screening answer.'; end if;
    for q in select value from jsonb_array_elements(revision.data->'questions') loop
      if answers?(q->>'id') and jsonb_typeof(answers->(q->>'id'))<>'string' then raise exception 'HH: Screening answers must be text.'; end if;
      answer:=private.trim_text(answers->>(q->>'id')); passed:=null;
      if length(answer)>5000 then raise exception 'HH: A screening answer is too long.'; end if;
      if answer='' and (q->>'required')::boolean then raise exception 'HH: Answer all required screening questions.'; end if;
      if answer<>'' then
        if q->>'type'='yesno' then
          if lower(answer) not in ('yes','no') then raise exception 'HH: Answer yes or no to the screening question.'; end if;
          answer:=case when lower(answer)='yes' then 'Yes' else 'No' end;
        elsif q->>'type'='choice' and not (q->'options')?answer then raise exception 'HH: Select one of the screening choices.';
        elsif q->>'type'='number' and answer!~'^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' then raise exception 'HH: Enter a valid numeric screening answer.';
        end if;
        if q->>'type'='number' then
          begin
            if length(answer)>100 or abs(answer::numeric)>1000000000000 then raise numeric_value_out_of_range; end if;
          exception when others then raise exception 'HH: Enter a valid numeric screening answer.'; end;
        end if;
        if (q->>'dealBreaker')::boolean then
          if q->>'type'='number' then
            passed:=case q->>'comparison' when 'minimum' then answer::numeric>=(q->>'expected')::numeric when 'maximum' then answer::numeric<=(q->>'expected')::numeric else answer::numeric=(q->>'expected')::numeric end;
          else passed:=answer=q->>'expected'; end if;
        end if;
      end if;
      normalized_answers:=normalized_answers||jsonb_build_object(q->>'id',answer);
      screening:=screening||jsonb_build_array(jsonb_build_object('questionId',q->>'id','label',q->>'label','passed',passed,'dealBreaker',(q->>'dealBreaker')::boolean));
    end loop;
    identifier:=gen_random_uuid()::text;
    document:=jsonb_build_object('id',identifier,'jobId',job.id,'jobVersion',job.approved_version,'applicantId',uid,'profile',profile,'jobSnapshot',private.job_json(job,job.approved_version),'answers',normalized_answers,'screening',screening,'status','submitted','submittedAt',action_time,'events',jsonb_build_array(jsonb_build_object('status','submitted','at',action_time)));
    insert into public.applications(id,job_id,job_version,applicant_id,data,submitted_at) values(identifier,job.id,job.approved_version,uid,document,action_time);

  elsif action='application.status' then
    target_status:=private.text_value(payload,'status',30);
    select * into application from public.applications where id=identifier for update;
    if not found then raise exception 'HH: Application not found.'; end if;
    if actor.role='applicant' then
      if application.applicant_id<>uid then raise exception 'HH: You may only withdraw your own application.'; end if;
      if target_status<>'withdrawn' then raise exception 'HH: Applicants may only withdraw an application.'; end if;
    elsif actor.role='employer' then
      select * into job from public.jobs where id=application.job_id;
      if not private.owns_company(job.company_id) then raise exception 'HH: You may only update applications for your own job.'; end if;
      if target_status not in ('shortlisted','rejected','hired') then raise exception 'HH: Employers cannot withdraw or submit an application.'; end if;
    else raise exception 'HH: Applicant or employer access is required.';
    end if;
    if application.status in ('hired','rejected','withdrawn') or application.status=target_status then raise exception 'HH: This application cannot change to that status.'; end if;
    update public.applications set status=target_status,data=data||jsonb_build_object('status',target_status,'events',(data->'events')||jsonb_build_array(jsonb_build_object('status',target_status,'at',action_time))) where id=identifier;

  elsif action='savedJob.toggle' then
    if actor.role<>'applicant' then raise exception 'HH: Applicant access is required.'; end if;
    if not payload?'saved' then raise exception 'HH: Choose whether to save this job.'; end if;
    identifier:=private.text_value(payload,'jobId',100);
    if identifier='' then raise exception 'HH: Choose a job to save.'; end if;
    if private.bool_value(payload,'saved') then
      if not (private.public_job(identifier) or private.applied_to(identifier)) then raise exception 'HH: This job is not available to save.'; end if;
      perform 1 from public.accounts where id=uid for update;
      if (select count(*) from public.saved_jobs where account_id=uid)>=500 and not exists(select 1 from public.saved_jobs where account_id=uid and job_id=identifier) then raise exception 'HH: You can save up to 500 jobs.'; end if;
      insert into public.saved_jobs(account_id,job_id) values(uid,identifier) on conflict do nothing;
    else
      delete from public.saved_jobs where account_id=uid and job_id=identifier;
    end if;

  elsif action='savedSearch.save' then
    if actor.role<>'applicant' then raise exception 'HH: Applicant access is required.'; end if;
    search_name:=private.text_value(payload,'name',100);
    if search_name='' then raise exception 'HH: Give this search a name.'; end if;
    document:=private.clean_job_filters(payload->'filters');
    alerts_on:=true;
    if payload?'alerts' then alerts_on:=private.bool_value(payload,'alerts'); end if;
    perform 1 from public.accounts where id=uid for update;
    if identifier='' then
      if (select count(*) from public.saved_searches where account_id=uid)>=50 then raise exception 'HH: You can save up to 50 searches.'; end if;
      insert into public.saved_searches(id,account_id,name,filters,alerts,created_at) values(gen_random_uuid()::text,uid,search_name,document,alerts_on,action_time);
    else
      update public.saved_searches set name=search_name,filters=document,alerts=alerts_on where id=identifier and account_id=uid;
      if not found then raise exception 'HH: Search not found.'; end if;
    end if;

  elsif action='savedSearch.delete' then
    if actor.role<>'applicant' then raise exception 'HH: Applicant access is required.'; end if;
    delete from public.saved_searches where id=identifier and account_id=uid;
    if not found then raise exception 'HH: Search not found.'; end if;

  elsif action='savedSearch.alerts' then
    if actor.role<>'applicant' then raise exception 'HH: Applicant access is required.'; end if;
    if not payload?'alerts' then raise exception 'HH: Choose an alert setting.'; end if;
    update public.saved_searches set alerts=private.bool_value(payload,'alerts') where id=identifier and account_id=uid;
    if not found then raise exception 'HH: Search not found.'; end if;

  elsif action in ('company.review','job.review','account.suspend') then
    if actor.role<>'admin' then raise exception 'HH: Administrator access is required.'; end if;
    reason:=private.text_value(payload,'reason',2000); target_status:=private.text_value(payload,'status',30);
    if (action='account.suspend' or target_status in ('rejected','suspended','removed')) and reason='' then raise exception 'HH: Provide a reason for this moderation decision.'; end if;
    if action='company.review' then
      if target_status not in ('approved','rejected','suspended') then raise exception 'HH: Invalid company review status.'; end if;
      select * into company from public.companies where id=identifier for update;
      if not found then raise exception 'HH: Company not found.'; end if;
      if target_status='approved' and company.status='draft' then raise exception 'HH: The company must be submitted before approval.'; end if;
      if target_status='approved' and not private.company_ready(company.data||coalesce((select data from public.company_contacts where company_id=company.id),'{}'::jsonb)) then raise exception 'HH: Complete company details and valid contacts before approval.'; end if;
      update public.companies set status=target_status,review_reason=reason,updated_at=action_time where id=identifier;
    elsif action='job.review' then
      if target_status not in ('approved','rejected','removed') then raise exception 'HH: Invalid job review status.'; end if;
      select * into job from public.jobs where id=identifier for update;
      if not found then raise exception 'HH: Job not found.'; end if;
      if target_status='removed' then update public.jobs set removed=true,closed=true,moderation_reason=reason where id=identifier;
      else
        select * into revision from public.job_revisions where job_id=identifier and version=job.working_version for update;
        if revision.status<>'pending' then raise exception 'HH: This job revision is not awaiting review.'; end if;
        if target_status='approved' and not private.public_company(job.company_id) then raise exception 'HH: Approve the company before approving its job.'; end if;
        update public.job_revisions set status=target_status,review_reason=reason where job_id=identifier and version=job.working_version;
        if target_status='approved' then update public.jobs set approved_version=working_version where id=identifier; end if;
      end if;
    else
      if identifier=uid::text then raise exception 'HH: You cannot suspend your own administrator account.'; end if;
      update public.accounts set suspended=true,suspension_reason=reason where id::text=identifier;
      if not found then raise exception 'HH: Account not found.'; end if;
    end if;
    insert into public.moderation_events(actor_id,target_id,action,reason,created_at) values(uid,identifier,action||case when action='account.suspend' then '' else '.'||target_status end,reason,action_time);
  else raise exception 'HH: Unsupported action.';
  end if;
  return public.workspace_snapshot();
end $$;

revoke all on function public.workspace_snapshot(),public.workspace_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.workspace_snapshot(),public.workspace_action(text,jsonb) to anon,authenticated;
revoke all on function private.clean_job_filters(jsonb) from public,anon,authenticated;
