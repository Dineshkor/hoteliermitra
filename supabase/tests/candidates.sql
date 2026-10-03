begin;
create or replace function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end $$;
create or replace function pg_temp.reject(statement text, fragment text) returns void language plpgsql as $$
declare rejected boolean:=false;
begin
  begin execute statement;
  exception when others then
    if position(fragment in sqlerrm)=0 then raise exception 'Unexpected rejection: %, expected %',sqlerrm,fragment; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'Expected rejection: %',statement; end if;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
('20000000-0000-0000-0000-000000000001','owner@test.example','{"role":"employer"}'),
('20000000-0000-0000-0000-000000000002','other@test.example','{"role":"employer"}');
insert into public.companies(id,owner_id,status,data) values('filter-company','20000000-0000-0000-0000-000000000001','approved','{"name":"Filter Hotel"}');
insert into public.jobs(id,company_id,working_version,approved_version) values('filter-job','filter-company',1,1);
insert into public.job_revisions(job_id,version,status,data) values('filter-job',1,'approved','{"title":"Filter Job"}');
do $$
declare n integer; uid uuid; application_data jsonb;
begin
  for n in 1..15 loop
    uid:=('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;
    insert into auth.users(id,email,raw_user_meta_data) values(uid,'candidate'||n||'@test.example','{"role":"applicant"}');
    application_data:=jsonb_build_object('id','filter-app-'||lpad(n::text,2,'0'),'applicantId',uid,'jobId','filter-job','jobVersion',1,'status',case when n<=3 then 'shortlisted' else 'submitted' end,'profile',jsonb_build_object('experience',n,'expectedSalary',n*1000,'city',case when mod(n,2)=0 then 'Mumbai' else 'Bengaluru' end,'availableFrom',current_date+n,'relocate',mod(n,2)=0,'workHistory',jsonb_build_array(jsonb_build_object('employer','Chain '||n,'propertyType',case when n<=5 then 'Restaurant' else 'Hotel' end))),'screening',jsonb_build_array(jsonb_build_object('dealBreaker',true,'passed',mod(n,2)=0)),'jobSnapshot','{}'::jsonb,'answers','{}'::jsonb,'events','[]'::jsonb,'submittedAt',now()+n*interval '1 minute');
    insert into public.applications(id,job_id,job_version,applicant_id,status,data,submitted_at) values('filter-app-'||lpad(n::text,2,'0'),'filter-job',1,uid,case when n<=3 then 'shortlisted' else 'submitted' end,application_data,now()+n*interval '1 minute');
  end loop;
end $$;
insert into public.companies(id,owner_id,status,data) values('foreign-company','20000000-0000-0000-0000-000000000002','approved','{"name":"Another Hotel"}');
insert into public.jobs(id,company_id,working_version,approved_version) values('foreign-job','foreign-company',1,1);
insert into public.job_revisions(job_id,version,status,data) values('foreign-job',1,'approved','{"title":"Another Job"}');
insert into public.applications(id,job_id,job_version,applicant_id,data) select 'foreign-application','foreign-job',1,applicant_id,data||'{"id":"foreign-application","jobId":"foreign-job"}'::jsonb from public.applications where id='filter-app-01';
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.reject($q$select public.candidate_search('filter-job','{}',1)$q$,'Sign in');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select pg_temp.reject($q$select public.candidate_search('filter-job','{}',1)$q$,'Employer');
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
select pg_temp.reject($q$select public.candidate_search('filter-job','{}',1)$q$,'own');
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
select pg_temp.check_true((public.candidate_search('filter-job','{}',1)->>'total')::integer=15,'total is independent of page length');
select pg_temp.check_true(jsonb_array_length(public.workspace_snapshot()->'applications')=0 and public.workspace_snapshot()->'applicationCounts'->'filter-job'='{"total":15,"submitted":12,"shortlisted":3}'::jsonb and public.workspace_snapshot()->'applicationCounts'->'foreign-job' is null,'workspace uses owned counts without full snapshots or foreign counts');
select pg_temp.check_true((public.candidate_search('filter-job','{"applicationId":"filter-app-02"}',1)->>'total')::integer=1 and public.candidate_search('filter-job','{"applicationId":"filter-app-02"}',1)->'applications'->0->>'id'='filter-app-02','candidate detail fetch selects one owned application');
select pg_temp.check_true((public.candidate_search('filter-job','{"applicationId":"foreign-application"}',1)->>'total')::integer=0,'candidate detail cannot leak another job application');
select pg_temp.reject($q$select public.candidate_search('foreign-job','{"applicationId":"foreign-application"}',1)$q$,'own');
select pg_temp.check_true(jsonb_array_length(public.candidate_search('filter-job','{}',1)->'applications')=12,'first page size is 12');
select pg_temp.check_true(jsonb_array_length(public.candidate_search('filter-job','{}',2)->'applications')=3,'second page contains remainder');
select pg_temp.check_true(public.candidate_search('filter-job','{}',1)->'applications'->0->>'id'='filter-app-15','newest sort is descending');
select pg_temp.check_true(public.candidate_search('filter-job','{"sort":"salary"}',1)->'applications'->0->>'id'='filter-app-01','salary sort is ascending');
select pg_temp.check_true(public.candidate_search('filter-job','{"sort":"experience"}',1)->'applications'->0->>'id'='filter-app-15','experience sort is descending');
select pg_temp.check_true(public.candidate_search('filter-job','{"sort":"joining"}',1)->'applications'->0->>'id'='filter-app-01','joining sort is ascending');
select pg_temp.check_true((public.candidate_search('filter-job','{"experienceMin":5,"experienceMax":8}',1)->>'total')::integer=4,'experience range is inclusive');
select pg_temp.check_true((public.candidate_search('filter-job','{"salaryMax":5000}',1)->>'total')::integer=5,'salary filter uses snapshot');
select pg_temp.check_true((public.candidate_search('filter-job','{"joiningDays":3}',1)->>'total')::integer=3,'joining days filter uses snapshot');
select pg_temp.check_true((public.candidate_search('filter-job','{"city":"mUMb"}',1)->>'total')::integer=7,'city matching ignores case');
select pg_temp.check_true((public.candidate_search('filter-job','{"workplace":"chain 15"}',1)->>'total')::integer=1,'workplace searches work history');
select pg_temp.check_true((public.candidate_search('filter-job','{"propertyType":"Restaurant"}',1)->>'total')::integer=5,'property type searches work history');
select pg_temp.check_true((public.candidate_search('filter-job','{"relocate":false}',1)->>'total')::integer=8,'false relocation filter is retained');
select pg_temp.check_true((public.candidate_search('filter-job','{"screening":"pass"}',1)->>'total')::integer=7,'screening pass requires all dealbreakers');
select pg_temp.check_true((public.candidate_search('filter-job','{"screening":"fail"}',1)->>'total')::integer=8,'screening fail finds failed criteria');
select pg_temp.check_true((public.candidate_search('filter-job','{"status":"shortlisted"}',1)->>'total')::integer=3,'status uses protected relational field');
select pg_temp.check_true((public.candidate_search('filter-job','{"salaryMax":1000,"relocate":true}',1)->>'total')::integer=0,'filters compose');
select pg_temp.reject($q$select public.candidate_search('filter-job','{}',0)$q$,'page');
select pg_temp.reject($q$select public.candidate_search('filter-job','{"status":"admin"}',1)$q$,'status');
select pg_temp.reject($q$select public.candidate_search('filter-job','{"experienceMin":-1}',1)$q$,'range');
select pg_temp.reject($q$select public.candidate_search('filter-job','{"relocate":"false"}',1)$q$,'true or false');
reset role;
update public.accounts set suspended=true where id='20000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.reject($q$select public.candidate_search('filter-job','{}',1)$q$,'suspended');
reset role;
rollback;
