create index applications_job_status_idx on public.applications(job_id,status,submitted_at desc);
create index applications_job_experience_idx on public.applications(job_id,((data->'profile'->>'experience')::numeric));
create index applications_job_salary_idx on public.applications(job_id,((data->'profile'->>'expectedSalary')::numeric));
create index applications_job_joining_idx on public.applications(job_id,(data->'profile'->>'availableFrom'));

create function public.candidate_search(job_id text,filters jsonb default '{}',page_number integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor public.accounts; requested_job text:=job_id; requested_application text; requested_status text; experience_min numeric; experience_max numeric; salary_max numeric; joining_days numeric; requested_city text; workplace text; property_type text; relocate boolean; screening text; sort_by text; result jsonb;
begin
  if auth.uid() is null then raise exception 'HH: Sign in to continue.'; end if;
  select * into actor from public.accounts where id=auth.uid();
  if actor.suspended then raise exception 'HH: Your account is suspended.'; end if;
  if actor.role is distinct from 'employer' then raise exception 'HH: Employer access is required.'; end if;
  if requested_job is null or length(requested_job)=0 or length(requested_job)>100 or not exists(select 1 from public.jobs j where j.id=requested_job and private.owns_company(j.company_id)) then raise exception 'HH: You may only view candidates for your own job.'; end if;
  if page_number is null or page_number<1 or page_number>100000 then raise exception 'HH: Choose a valid page.'; end if;
  if filters is null or jsonb_typeof(filters)<>'object' or octet_length(filters::text)>16000 then raise exception 'HH: Invalid candidate filters.'; end if;
  requested_application:=private.text_value(filters,'applicationId',100);
  requested_status:=private.text_value(filters,'status',30);
  if requested_status<>'' and requested_status not in ('submitted','shortlisted','rejected','hired','withdrawn') then raise exception 'HH: Invalid application status filter.'; end if;
  experience_min:=private.number_value(filters,'experienceMin',null); experience_max:=private.number_value(filters,'experienceMax',null); salary_max:=private.number_value(filters,'salaryMax',null); joining_days:=private.number_value(filters,'joiningDays',null);
  if experience_min>experience_max then raise exception 'HH: Check the experience range.'; end if;
  if joining_days>3650 or mod(joining_days,1)<>0 then raise exception 'HH: Choose a valid joining period.'; end if;
  requested_city:=private.text_value(filters,'city',200); workplace:=private.text_value(filters,'workplace',200); property_type:=private.text_value(filters,'propertyType',200);
  if filters?'relocate' then relocate:=private.bool_value(filters,'relocate'); end if;
  screening:=private.text_value(filters,'screening',20); sort_by:=coalesce(nullif(private.text_value(filters,'sort',20),''),'newest');
  if screening<>'' and screening not in ('pass','fail') then raise exception 'HH: Invalid screening filter.'; end if;
  if sort_by not in ('newest','experience','salary','joining') then raise exception 'HH: Invalid candidate sort.'; end if;

  with filtered as materialized (
    select a.id,a.submitted_at,a.data||jsonb_build_object('id',a.id,'status',a.status) as document,
      (a.data->'profile'->>'experience')::numeric as experience,
      (a.data->'profile'->>'expectedSalary')::numeric as salary,
      a.data->'profile'->>'availableFrom' as joining
    from public.applications a
    where a.job_id=requested_job
      and (requested_application='' or a.id=requested_application)
      and (requested_status='' or a.status=requested_status)
      and (experience_min is null or (a.data->'profile'->>'experience')::numeric>=experience_min)
      and (experience_max is null or (a.data->'profile'->>'experience')::numeric<=experience_max)
      and (salary_max is null or (a.data->'profile'->>'expectedSalary')::numeric<=salary_max)
      and (joining_days is null or (a.data->'profile'->>'availableFrom')::date<=current_date+joining_days::integer)
      and (requested_city='' or strpos(lower(a.data->'profile'->>'city'),lower(requested_city))>0)
      and (workplace='' or exists(select 1 from jsonb_array_elements(a.data->'profile'->'workHistory') w where strpos(lower(w->>'employer'),lower(workplace))>0))
      and (property_type='' or exists(select 1 from jsonb_array_elements(a.data->'profile'->'workHistory') w where w->>'propertyType'=property_type))
      and (relocate is null or (a.data->'profile'->>'relocate')::boolean=relocate)
      and (screening='' or (screening='fail')=exists(select 1 from jsonb_array_elements(a.data->'screening') s where (s->>'dealBreaker')::boolean and s->'passed' is distinct from 'true'::jsonb))
  ), ordered as (
    select document,row_number() over(order by
      case when sort_by='experience' then experience end desc,
      case when sort_by='salary' then salary end asc,
      case when sort_by='joining' then joining end asc,
      submitted_at desc,id desc) as position
    from filtered
  ), paged as (select document,position from ordered order by position limit 12 offset ((page_number-1)*12))
  select jsonb_build_object('total',(select count(*) from filtered),'applications',coalesce((select jsonb_agg(document order by position) from paged),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.candidate_search(text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.candidate_search(text,jsonb,integer) to anon,authenticated;
