-- The browser gets read-only RLS access. All writes pass through checked transactions.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- Keep these catalogs aligned with src/lib/taxonomy.ts (verified by the test runner).
create table private.hospitality_roles(department text not null,role text not null,primary key(department,role));
insert into private.hospitality_roles(department,role) values
('Kitchen','Commis Chef'),('Kitchen','Chef de Partie'),('Kitchen','Sous Chef'),('Kitchen','Executive Chef'),('Kitchen','Cook'),('Kitchen','Kitchen Helper'),
('Food & Beverage Service','F&B Associate'),('Food & Beverage Service','Waiter'),('Food & Beverage Service','Steward'),('Food & Beverage Service','Bartender'),('Food & Beverage Service','F&B Supervisor'),('Food & Beverage Service','Restaurant Manager'),
('Front Office','Front Desk Associate'),('Front Office','Receptionist'),('Front Office','Guest Relations Executive'),('Front Office','Front Office Manager'),
('Housekeeping','Housekeeping Associate'),('Housekeeping','Room Attendant'),('Housekeeping','Housekeeping Supervisor'),('Housekeeping','Executive Housekeeper'),
('Maintenance','Maintenance Technician'),('Maintenance','Electrician'),('Maintenance','Engineering Supervisor'),
('Management','Hotel Manager'),('Management','Resort Manager'),('Management','Operations Manager'),('Management','Catering Manager');
create table private.hospitality_property_types(name text primary key);
insert into private.hospitality_property_types(name) values ('Hotel'),('Restaurant'),('Resort'),('Cafe'),('Catering'),('Serviced accommodation'),('Other hospitality property');
revoke all on private.hospitality_roles,private.hospitality_property_types from public,anon,authenticated;

create table public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'applicant' check (role in ('applicant','employer','admin')),
  suspended boolean not null default false,
  suspension_reason text not null default '',
  created_at timestamptz not null default now()
);
create table public.applicant_profiles (
  id uuid primary key references public.accounts(id),
  data jsonb not null check (jsonb_typeof(data)='object'),
  updated_at timestamptz not null default now()
);
create table public.companies (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.accounts(id),
  status text not null default 'pending' check (status in ('draft','pending','approved','rejected','suspended')),
  review_reason text not null default '',
  data jsonb not null check (jsonb_typeof(data)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.jobs (
  id text primary key default gen_random_uuid()::text,
  company_id text not null references public.companies(id),
  approved_version integer,
  working_version integer not null,
  closed boolean not null default false,
  removed boolean not null default false,
  moderation_reason text not null default '',
  created_at timestamptz not null default now()
);
create table public.company_contacts (
  company_id text primary key references public.companies(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data)='object')
);
create table public.job_revisions (
  job_id text not null references public.jobs(id),
  version integer not null check (version>0),
  status text not null check (status in ('draft','pending','approved','rejected')),
  review_reason text not null default '',
  data jsonb not null check (jsonb_typeof(data)='object'),
  created_at timestamptz not null default now(),
  primary key (job_id,version)
);
alter table public.jobs add constraint jobs_approved_revision_fk foreign key (id,approved_version) references public.job_revisions(job_id,version) deferrable initially deferred;
alter table public.jobs add constraint jobs_working_revision_fk foreign key (id,working_version) references public.job_revisions(job_id,version) deferrable initially deferred;
create table public.applications (
  id text primary key default gen_random_uuid()::text,
  job_id text not null references public.jobs(id),
  job_version integer not null,
  applicant_id uuid not null references public.accounts(id),
  status text not null default 'submitted' check (status in ('submitted','shortlisted','rejected','hired','withdrawn')),
  data jsonb not null check (jsonb_typeof(data)='object'),
  submitted_at timestamptz not null default now(),
  unique (job_id,applicant_id),
  foreign key (job_id,job_version) references public.job_revisions(job_id,version)
);
create table public.moderation_events (
  id text primary key default gen_random_uuid()::text,
  actor_id uuid not null references public.accounts(id),
  target_id text not null,
  action text not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);
create index companies_owner_idx on public.companies(owner_id);
create index jobs_company_idx on public.jobs(company_id);
create index applications_applicant_idx on public.applications(applicant_id);
create index applications_job_idx on public.applications(job_id);

create function private.signup_account() returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Never trust a signup request to assign moderation privileges.
  insert into public.accounts(id,role) values(new.id,case when new.raw_user_meta_data->>'role'='employer' then 'employer' else 'applicant' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.signup_account();
insert into public.accounts(id,role) select id,case when raw_user_meta_data->>'role'='employer' then 'employer' else 'applicant' end from auth.users on conflict do nothing;

create function private.is_active() returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is null or exists(select 1 from public.accounts where id=auth.uid() and not suspended)
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.accounts where id=auth.uid() and role='admin' and not suspended)
$$;
create function private.owns_company(company text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.companies c join public.accounts a on a.id=c.owner_id where c.id=company and a.id=auth.uid() and not a.suspended)
$$;
create function private.public_company(company text) returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active() and exists(select 1 from public.companies c join public.accounts a on a.id=c.owner_id where c.id=company and c.status='approved' and not a.suspended)
$$;
create function private.public_job(job text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.jobs j where j.id=job and j.approved_version is not null and not j.closed and not j.removed and private.public_company(j.company_id))
$$;
create function private.applied_to(job text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.applications a join public.accounts actor on actor.id=a.applicant_id where a.job_id=job and actor.id=auth.uid() and actor.role='applicant' and not actor.suspended)
$$;
create function private.applied_revision(job text,revision integer) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.applications a join public.accounts actor on actor.id=a.applicant_id where a.job_id=job and a.job_version=revision and actor.id=auth.uid() and actor.role='applicant' and not actor.suspended)
$$;

alter table public.accounts enable row level security;
alter table public.applicant_profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_contacts enable row level security;
alter table public.jobs enable row level security;
alter table public.job_revisions enable row level security;
alter table public.applications enable row level security;
alter table public.moderation_events enable row level security;
create policy accounts_read on public.accounts for select using (id=auth.uid() or private.is_admin());
create policy profiles_read on public.applicant_profiles for select using (private.is_active() and (id=auth.uid() or private.is_admin()));
create policy companies_read on public.companies for select using (private.public_company(id) or private.owns_company(id) or private.is_admin());
create policy company_contacts_read on public.company_contacts for select using (private.owns_company(company_id) or private.is_admin());
create policy jobs_read on public.jobs for select using (private.public_job(id) or private.applied_to(id) or private.owns_company(company_id) or private.is_admin());
create policy revisions_read on public.job_revisions for select using (
  private.is_admin() or private.applied_revision(job_id,version) or exists(select 1 from public.jobs j where j.id=job_id and (private.owns_company(j.company_id) or (j.approved_version=version and private.public_job(j.id))))
);
create policy applications_read on public.applications for select using (
  private.is_active() and (applicant_id=auth.uid() or private.is_admin() or exists(select 1 from public.jobs j where j.id=job_id and private.owns_company(j.company_id)))
);
create policy moderation_read on public.moderation_events for select using (private.is_admin());
revoke all on public.accounts,public.applicant_profiles,public.companies,public.company_contacts,public.jobs,public.job_revisions,public.applications,public.moderation_events from anon,authenticated;
grant select on public.accounts,public.applicant_profiles,public.companies,public.company_contacts,public.jobs,public.job_revisions,public.applications,public.moderation_events to anon,authenticated;

create function private.immutable_revision() returns trigger language plpgsql set search_path='' as $$
begin
  if new.data is distinct from old.data or new.job_id<>old.job_id or new.version<>old.version or new.created_at<>old.created_at then raise exception 'HH: Job revision content is immutable.'; end if;
  return new;
end $$;
create trigger revision_content_immutable before update on public.job_revisions for each row execute function private.immutable_revision();
create function private.immutable_application() returns trigger language plpgsql set search_path='' as $$
begin
  if new.id<>old.id or new.job_id<>old.job_id or new.job_version<>old.job_version or new.applicant_id<>old.applicant_id or new.submitted_at<>old.submitted_at or (new.data-'status'-'events') is distinct from (old.data-'status'-'events') then raise exception 'HH: Application snapshots are immutable.'; end if;
  return new;
end $$;
create trigger application_snapshot_immutable before update on public.applications for each row execute function private.immutable_application();

-- Validation is repeated in PostgreSQL so direct authenticated RPC calls are safe.
create function private.check_hospitality(department text,role_name text) returns void language plpgsql set search_path='' as $$
begin
  if department<>'' and not exists(select 1 from private.hospitality_roles r where r.department=check_hospitality.department) then raise exception 'HH: Choose a hospitality department.'; end if;
  if role_name<>'' and not exists(select 1 from private.hospitality_roles r where r.department=check_hospitality.department and r.role=role_name) then raise exception 'HH: Choose a hospitality role in the selected department.'; end if;
end $$;
create function private.check_property(property_type text) returns void language plpgsql set search_path='' as $$
begin
  if property_type<>'' and not exists(select 1 from private.hospitality_property_types where name=property_type) then raise exception 'HH: Choose a hospitality property type.'; end if;
end $$;
-- Match JavaScript boundary trimming, including tabs/newlines and Unicode spaces.
create function private.trim_text(input_text text) returns text language sql immutable set search_path='' as $$
  with whitespace as (
    select '[[:space:]'||U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'||']' as characters
  )
  select pg_catalog.regexp_replace(coalesce(input_text,''),'^'||characters||'+|'||characters||'+$','','g') from whitespace
$$;
create function private.text_value(p jsonb,k text,max_length integer default 5000) returns text language plpgsql immutable set search_path='' as $$
declare result text;
begin
  if p?k and jsonb_typeof(p->k) not in ('string','null') then raise exception 'HH: % must be text.',k; end if;
  result:=private.trim_text(p->>k);
  if length(result)>max_length then raise exception 'HH: % is too long.',k; end if;
  return result;
end $$;
create function private.number_value(p jsonb,k text,fallback numeric default 0) returns numeric language plpgsql immutable set search_path='' as $$
declare result numeric;
begin
  if not p?k or p->k='null'::jsonb then return fallback; end if;
  if jsonb_typeof(p->k)<>'number' then raise exception 'HH: % must be a number.',k; end if;
  result:=(p->>k)::numeric;
  if result<0 or result>1000000000 then raise exception 'HH: % is outside the allowed range.',k; end if;
  return result;
end $$;
create function private.bool_value(p jsonb,k text) returns boolean language plpgsql immutable set search_path='' as $$
begin
  if not p?k then return false; end if;
  if jsonb_typeof(p->k)<>'boolean' then raise exception 'HH: % must be true or false.',k; end if;
  return (p->>k)::boolean;
end $$;
create function private.string_array(p jsonb,k text) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:=coalesce(p->k,'[]'::jsonb); v jsonb; normalized jsonb:='[]'; text_item text;
begin
  if jsonb_typeof(result)<>'array' or jsonb_array_length(result)>100 then raise exception 'HH: % must be a list of up to 100 items.',k; end if;
  for v in select value from jsonb_array_elements(result) loop
    text_item:=private.trim_text(v#>>'{}');
    if jsonb_typeof(v)<>'string' or length(text_item)>200 or text_item='' then raise exception 'HH: % contains an invalid value.',k; end if;
    normalized:=normalized||jsonb_build_array(text_item);
  end loop;
  return normalized;
end $$;
create function private.date_value(p jsonb,k text,month_only boolean default false) returns text language plpgsql immutable set search_path='' as $$
declare result text:=private.text_value(p,k,10); checked date;
begin
  if result='' then return ''; end if;
  if (month_only and result!~'^\d{4}-\d{2}$') or (not month_only and result!~'^\d{4}-\d{2}-\d{2}$') then raise exception 'HH: % is not a valid date.',k; end if;
  begin checked:=(case when month_only then result||'-01' else result end)::date;
  exception when others then raise exception 'HH: % is not a valid date.',k; end;
  return result;
end $$;
create function private.clean_profile(p jsonb,uid uuid) returns jsonb language plpgsql set search_path='' as $$
declare history jsonb:=coalesce(p->'workHistory','[]'::jsonb); languages jsonb:=coalesce(p->'languages','[]'::jsonb); w jsonb; history_out jsonb:='[]'; languages_out jsonb:='[]'; start_date text; end_date text; current_job boolean;
begin
  perform private.check_hospitality(private.text_value(p,'department',100),private.text_value(p,'role',100));
  if jsonb_typeof(history)<>'array' or jsonb_array_length(history)>100 or jsonb_typeof(languages)<>'array' or jsonb_array_length(languages)>50 then raise exception 'HH: Work history and languages must be lists.'; end if;
  for w in select value from jsonb_array_elements(history) loop
    if jsonb_typeof(w)<>'object' then raise exception 'HH: Work history contains an invalid entry.'; end if;
    start_date:=private.date_value(w,'start',true); end_date:=private.date_value(w,'end',true); current_job:=private.bool_value(w,'current');
    perform private.check_property(private.text_value(w,'propertyType',100));
    if not current_job and start_date<>'' and end_date<>'' and end_date<start_date then raise exception 'HH: Workplace end date cannot precede its start date.'; end if;
    history_out:=history_out||jsonb_build_array(jsonb_build_object('id',private.text_value(w,'id',100),'employer',private.text_value(w,'employer',200),'propertyType',private.text_value(w,'propertyType',100),'role',private.text_value(w,'role',100),'start',start_date,'end',case when current_job then '' else end_date end,'current',current_job,'reason',private.text_value(w,'reason',1000)));
  end loop;
  for w in select value from jsonb_array_elements(languages) loop
    if jsonb_typeof(w)<>'object' or private.text_value(w,'name',100)='' or private.text_value(w,'proficiency',100)='' then raise exception 'HH: Complete every spoken language.'; end if;
    languages_out:=languages_out||jsonb_build_array(jsonb_build_object('name',private.text_value(w,'name',100),'proficiency',private.text_value(w,'proficiency',100)));
  end loop;
  if private.number_value(p,'noticeDays')>365 or mod(private.number_value(p,'noticeDays'),1)<>0 or private.number_value(p,'experience')>80 then raise exception 'HH: Check your experience and notice period.'; end if;
  return jsonb_build_object('id',uid::text,'name',private.text_value(p,'name',200),'phone',private.text_value(p,'phone',30),'email',private.text_value(p,'email',320),'city',private.text_value(p,'city',100),'department',private.text_value(p,'department',100),'role',private.text_value(p,'role',100),'experience',private.number_value(p,'experience'),'workHistory',history_out,'skills',private.string_array(p,'skills'),'certifications',private.string_array(p,'certifications'),'languages',languages_out,'currentSalary',private.number_value(p,'currentSalary',null),'expectedSalary',private.number_value(p,'expectedSalary'),'noticeDays',private.number_value(p,'noticeDays'),'availableFrom',private.date_value(p,'availableFrom'),'relocate',private.bool_value(p,'relocate'),'preferredCities',private.string_array(p,'preferredCities'));
end $$;
create function private.valid_phone(phone text) returns boolean language sql immutable set search_path='' as $$
  select coalesce(phone~'^\+?[0-9 -]+$' and length(regexp_replace(phone,'[^0-9]','','g')) between 10 and 15,false)
$$;
create function private.valid_email(email text) returns boolean language sql immutable set search_path='' as $$
  select coalesce(email~'^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?([.][A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$',false)
$$;
create function private.company_ready(p jsonb) returns boolean language sql stable set search_path='' as $$
  select coalesce(
    private.trim_text(p->>'name')<>'' and
    exists(select 1 from private.hospitality_property_types where name=private.trim_text(p->>'type')) and
    private.trim_text(p->>'city')<>'' and
    private.trim_text(p->>'address')<>'' and
    private.trim_text(p->>'description')<>'' and
    private.valid_phone(private.trim_text(p->>'phone')) and private.valid_email(private.trim_text(p->>'email')),false)
$$;
create function private.profile_ready(p jsonb) returns boolean language plpgsql set search_path='' as $$
declare w jsonb;
begin
  if p is null or private.trim_text(p->>'name')='' or not private.valid_phone(private.trim_text(p->>'phone')) or private.trim_text(p->>'city')='' or private.trim_text(p->>'department')='' or private.trim_text(p->>'role')='' or (p->>'expectedSalary')::numeric<=0 or private.trim_text(p->>'availableFrom')='' or jsonb_array_length(p->'languages')=0 then return false; end if;
  if (p->>'experience')::numeric>0 and jsonb_array_length(p->'workHistory')=0 then return false; end if;
  for w in select value from jsonb_array_elements(p->'workHistory') loop
    if private.trim_text(w->>'employer')='' or private.trim_text(w->>'propertyType')='' or private.trim_text(w->>'role')='' or private.trim_text(w->>'start')='' or (not (w->>'current')::boolean and private.trim_text(w->>'end')='') then return false; end if;
  end loop;
  for w in select value from jsonb_array_elements(p->'languages') loop
    if private.trim_text(w->>'name')='' or private.trim_text(w->>'proficiency')='' then return false; end if;
  end loop;
  return true;
end $$;
create function private.clean_questions(p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare questions jsonb:=coalesce(p->'questions','[]'::jsonb); q jsonb; out_questions jsonb:='[]'; ids text[]:='{}'; qid text; qtype text; expected text; comparison text; opts jsonb; breaker boolean; required_answer boolean;
begin
  if jsonb_typeof(questions)<>'array' or jsonb_array_length(questions)>5 then raise exception 'HH: Use up to five screening questions.'; end if;
  for q in select value from jsonb_array_elements(questions) loop
    if jsonb_typeof(q)<>'object' then raise exception 'HH: Invalid screening question.'; end if;
    qid:=private.text_value(q,'id',100); qtype:=private.text_value(q,'type',20); expected:=private.text_value(q,'expected',1000); comparison:=coalesce(nullif(private.text_value(q,'comparison',20),''),'equal'); opts:=private.string_array(q,'options'); breaker:=private.bool_value(q,'dealBreaker'); required_answer:=private.bool_value(q,'required');
    if qid='' or qid=any(ids) then raise exception 'HH: Screening question identifiers must be unique.'; end if;
    if qid in ('constructor','__proto__','toString','toLocaleString','valueOf','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__') then raise exception 'HH: This screening question identifier is reserved.'; end if;
    ids:=array_append(ids,qid);
    if qtype not in ('yesno','choice','number','text') or private.text_value(q,'label',500)='' then raise exception 'HH: Give each screening question a type and label.'; end if;
    if comparison not in ('equal','minimum','maximum') or (qtype<>'number' and comparison<>'equal') then raise exception 'HH: Invalid screening comparison.'; end if;
    if qtype='choice' and (jsonb_array_length(opts)<2 or jsonb_array_length(opts)>10 or (select count(distinct value) from jsonb_array_elements(opts))<>jsonb_array_length(opts)) then raise exception 'HH: Choice questions need two to ten unique options.'; end if;
    if breaker and qtype='text' then raise exception 'HH: Text questions cannot be deal-breakers.'; end if;
    if breaker and expected='' then raise exception 'HH: Set an expected answer for every deal-breaker.'; end if;
    if breaker and qtype='yesno' then
      if lower(expected) not in ('yes','no') then raise exception 'HH: Expected answer must be yes or no.'; end if;
      expected:=case when lower(expected)='yes' then 'Yes' else 'No' end;
    end if;
    if breaker and qtype='choice' and not opts?expected then raise exception 'HH: Expected answer must be one of the choices.'; end if;
    if breaker and qtype='number' and expected!~'^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' then raise exception 'HH: Set a numeric expected answer.'; end if;
    if breaker and qtype='number' then
      begin
        if length(expected)>100 or abs(expected::numeric)>1000000000000 then raise numeric_value_out_of_range; end if;
      exception when others then raise exception 'HH: Set a valid numeric expected answer.'; end;
    end if;
    out_questions:=out_questions||jsonb_build_array(jsonb_build_object('id',qid,'label',private.text_value(q,'label',500),'type',qtype,'options',case when qtype='choice' then opts else '[]'::jsonb end,'required',required_answer,'dealBreaker',breaker,'expected',expected,'comparison',comparison));
  end loop;
  return out_questions;
end $$;
create function private.clean_job(p jsonb,job_id text,company_id text,version integer,created_at timestamptz,review_status text) returns jsonb language plpgsql set search_path='' as $$
declare salary_min numeric:=private.number_value(p,'salaryMin'); salary_max numeric:=private.number_value(p,'salaryMax'); experience_min numeric:=private.number_value(p,'experienceMin'); experience_max numeric:=private.number_value(p,'experienceMax',null); openings numeric:=private.number_value(p,'openings',1); questions jsonb; property_type text:=private.text_value(p,'propertyType',100); employment_type text:=private.text_value(p,'employmentType',100); shift_type text:=private.text_value(p,'shift',100);
begin
  if salary_min>salary_max then raise exception 'HH: Salary minimum cannot exceed maximum.'; end if;
  if experience_min>80 or experience_max>80 or experience_max<experience_min then raise exception 'HH: Check the experience range.'; end if;
  if openings<1 or openings>1000 or mod(openings,1)<>0 then raise exception 'HH: Enter a valid number of openings.'; end if;
  questions:=private.clean_questions(p);
  perform private.check_hospitality(private.text_value(p,'department',100),private.text_value(p,'role',100));
  perform private.check_property(property_type);
  if review_status='pending' and property_type='' then raise exception 'HH: Choose a hospitality property type before submitting for review.'; end if;
  if (review_status='pending' and employment_type='') or (employment_type<>'' and employment_type not in ('Full time','Part time','Contract','Seasonal','Internship')) then raise exception 'HH: Choose a valid employment type.'; end if;
  if (review_status='pending' and shift_type='') or (shift_type<>'' and shift_type not in ('Day shift','Evening shift','Night shift','Rotational','Split shift')) then raise exception 'HH: Choose a valid shift type.'; end if;
  if review_status='pending' and (private.text_value(p,'title',200)='' or private.text_value(p,'department',100)='' or private.text_value(p,'role',100)='' or private.text_value(p,'city',100)='' or private.text_value(p,'locality',200)='' or private.text_value(p,'description',15000)='' or salary_min<=0 or salary_max<=0) then raise exception 'HH: Complete the job title, role, location, description and salary before submitting for review.'; end if;
  return jsonb_build_object('id',job_id,'companyId',company_id,'version',version,'title',private.text_value(p,'title',200),'department',private.text_value(p,'department',100),'role',private.text_value(p,'role',100),'city',private.text_value(p,'city',100),'locality',private.text_value(p,'locality',200),'propertyType',private.text_value(p,'propertyType',100),'employmentType',private.text_value(p,'employmentType',100),'experienceMin',experience_min,'experienceMax',experience_max,'salaryMin',salary_min,'salaryMax',salary_max,'shift',private.text_value(p,'shift',100),'accommodation',private.bool_value(p,'accommodation'),'meals',private.bool_value(p,'meals'),'openings',openings,'description',private.text_value(p,'description',15000),'skills',private.string_array(p,'skills'),'languages',private.string_array(p,'languages'),'joiningBy',private.date_value(p,'joiningBy'),'questions',questions,'status',review_status,'reviewReason','','createdAt',created_at);
end $$;

create function private.company_json(c public.companies,show_contacts boolean) returns jsonb language sql stable set search_path='' as $$
  select c.data||case when show_contacts then coalesce((select data from public.company_contacts where company_id=c.id),'{}'::jsonb) else '{"address":"","phone":"","email":""}'::jsonb end||jsonb_build_object('id',c.id,'ownerId',c.owner_id,'status',c.status,'reviewReason',case when show_contacts then c.review_reason else '' end)
$$;
create function private.job_json(j public.jobs,v integer) returns jsonb language sql stable set search_path='' as $$
  select r.data||jsonb_build_object('status',case when j.removed then 'removed' when j.closed then 'closed' else r.status end,'reviewReason',case when j.removed then j.moderation_reason else r.review_reason end) from public.job_revisions r where r.job_id=j.id and r.version=v
$$;
create function public.workspace_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); actor public.accounts; company_list jsonb; job_list jsonb; application_list jsonb; profile jsonb; moderation jsonb; account_list jsonb; application_counts jsonb;
begin
  select * into actor from public.accounts where id=uid;
  if actor.suspended then return jsonb_build_object('role',actor.role,'userId',uid,'profile',null,'companies','[]'::jsonb,'jobs','[]'::jsonb,'applications','[]'::jsonb,'moderation','[]'::jsonb,'suspended',true,'suspensionReason',actor.suspension_reason); end if;
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
  return jsonb_build_object('role',actor.role,'userId',uid,'profile',profile,'companies',company_list,'jobs',job_list,'applications',application_list,'moderation',moderation,'suspended',false)||case when actor.role='admin' then jsonb_build_object('accounts',account_list) when actor.role='employer' then jsonb_build_object('applicationCounts',application_counts) else '{}'::jsonb end;
end $$;

create function public.workspace_action(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); actor public.accounts; company public.companies; job public.jobs; revision public.job_revisions; application public.applications; identifier text; target_status text; reason text; document jsonb; profile jsonb; answers jsonb; screening jsonb:='[]'; q jsonb; answer text; passed boolean; normalized_answers jsonb:='{}'; action_time timestamptz:=clock_timestamp(); new_version integer;
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

-- PostgreSQL gives PUBLIC function execute by default. Revoke it explicitly.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_active(),private.is_admin(),private.owns_company(text),private.public_company(text),private.public_job(text),private.applied_to(text),private.applied_revision(text,integer) to anon,authenticated;
revoke all on function public.workspace_snapshot(),public.workspace_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.workspace_snapshot(),public.workspace_action(text,jsonb) to anon,authenticated;
