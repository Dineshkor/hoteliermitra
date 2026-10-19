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
('10000000-0000-0000-0000-000000000001','saver@test.example','{"role":"applicant"}'),
('10000000-0000-0000-0000-000000000002','other@test.example','{"role":"applicant"}'),
('20000000-0000-0000-0000-000000000001','saveowner@test.example','{"role":"employer"}');
insert into public.companies(id,owner_id,status,data) values
('saved-company','20000000-0000-0000-0000-000000000001','approved','{"name":"Saved Hotel"}');
insert into public.jobs(id,company_id,working_version,approved_version) values
('saved-job','saved-company',1,1),
('pending-job','saved-company',1,null),
('removed-job','saved-company',1,1),
('cap-extra','saved-company',1,1);
update public.jobs set removed=true,closed=true where id='removed-job';
insert into public.job_revisions(job_id,version,status,data) values
('saved-job',1,'approved','{"title":"Saved Job"}'),
('pending-job',1,'pending','{"title":"Pending Job"}'),
('removed-job',1,'approved','{"title":"Removed Job"}'),
('cap-extra',1,'approved','{"title":"Cap Job"}');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select public.workspace_action('savedJob.toggle','{"jobId":"saved-job","saved":true}');
select pg_temp.check_true((public.workspace_snapshot()->'savedJobIds')?'saved-job','saved job id is in the snapshot');
select public.workspace_action('savedJob.toggle','{"jobId":"saved-job","saved":true}');
select pg_temp.check_true((select count(*)=1 from public.saved_jobs where job_id='saved-job'),'duplicate save is idempotent');
select pg_temp.reject($q$select public.workspace_action('savedJob.toggle','{"jobId":"pending-job","saved":true}')$q$,'not available');
select pg_temp.reject($q$select public.workspace_action('savedJob.toggle','{"jobId":"removed-job","saved":true}')$q$,'not available');
select pg_temp.reject($q$select public.workspace_action('savedJob.toggle','{"jobId":"saved-job","saved":"yes"}')$q$,'true or false');
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
select pg_temp.reject($q$select public.workspace_action('savedJob.toggle','{"jobId":"saved-job","saved":true}')$q$,'Applicant access');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);

select public.workspace_action('savedSearch.save','{"id":"","name":" Weekend chefs ","filters":{"q":"chef","department":"Kitchen","salaryMin":20000,"sort":"salary","unknown":"dropped"},"alerts":true}');
select pg_temp.check_true((select name='Weekend chefs' and filters='{"q":"chef","city":"","department":"Kitchen","propertyType":"","salaryMin":20000,"stay":false,"meals":false,"sort":"salary"}'::jsonb and alerts from public.saved_searches where account_id='10000000-0000-0000-0000-000000000001'),'search is trimmed, canonical and alerting');
select pg_temp.check_true((public.workspace_snapshot()->'savedSearches'->0->>'name')='Weekend chefs','saved search appears in the snapshot');
select pg_temp.reject($q$select public.workspace_action('savedSearch.save','{"id":"","name":"Bad","filters":{"department":"Astrology"},"alerts":true}')$q$,'valid department');
select pg_temp.reject($q$select public.workspace_action('savedSearch.save','{"id":"","name":"Bad","filters":[],"alerts":true}')$q$,'Invalid search filters');
select pg_temp.reject($q$select public.workspace_action('savedSearch.save','{"id":"","name":"","filters":{},"alerts":true}')$q$,'name');
select public.workspace_action('savedSearch.save',jsonb_build_object('id',(select id from public.saved_searches where account_id='10000000-0000-0000-0000-000000000001'),'name','Weekend chefs','filters','{}'::jsonb,'alerts',false));
select pg_temp.check_true((select alerts=false and filters='{"q":"","city":"","department":"","propertyType":"","salaryMin":0,"stay":false,"meals":false,"sort":"newest"}'::jsonb from public.saved_searches where account_id='10000000-0000-0000-0000-000000000001'),'search update replaces filters and alerts');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select pg_temp.check_true((select count(*)=0 from public.saved_jobs),'saved jobs are private');
select pg_temp.check_true((select count(*)=0 from public.saved_searches),'saved searches are private');
select pg_temp.check_true(not ((public.workspace_snapshot()->'savedJobIds')?'saved-job'),'other applicants see no saved ids');
select pg_temp.reject($q$insert into public.saved_jobs(account_id,job_id) values(auth.uid(),'saved-job')$q$,'permission denied');
select pg_temp.reject($q$select public.workspace_action('savedSearch.alerts','{"id":"00000000-0000-0000-0000-000000000000","alerts":false}')$q$,'not found');
select pg_temp.reject($q$select public.workspace_action('savedSearch.delete','{"id":"00000000-0000-0000-0000-000000000000"}')$q$,'not found');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select public.workspace_action('savedSearch.alerts',jsonb_build_object('id',(select id from public.saved_searches where account_id='10000000-0000-0000-0000-000000000001'),'alerts',true));
select pg_temp.check_true((select alerts from public.saved_searches where account_id='10000000-0000-0000-0000-000000000001'),'alerts can be turned back on');
select public.workspace_action('savedSearch.delete',jsonb_build_object('id',(select id from public.saved_searches where account_id='10000000-0000-0000-0000-000000000001')));
select pg_temp.check_true((select count(*)=0 from public.saved_searches),'search delete removes the row');

reset role;
do $$
declare n integer;
begin
  for n in 1..500 loop
    insert into public.jobs(id,company_id,working_version,approved_version) values('cap-job-'||n,'saved-company',1,1);
    insert into public.job_revisions(job_id,version,status,data) values('cap-job-'||n,1,'approved','{"title":"Cap Job"}');
    insert into public.saved_jobs(account_id,job_id) values('10000000-0000-0000-0000-000000000001','cap-job-'||n);
  end loop;
  for n in 1..50 loop
    insert into public.saved_searches(id,account_id,name,filters) values('cap-search-'||n,'10000000-0000-0000-0000-000000000001','Cap '||n,'{}');
  end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select pg_temp.reject($q$select public.workspace_action('savedJob.toggle','{"jobId":"cap-extra","saved":true}')$q$,'up to 500');
select pg_temp.reject($q$select public.workspace_action('savedSearch.save','{"id":"","name":"One more","filters":{},"alerts":true}')$q$,'up to 50');
select public.workspace_action('savedJob.toggle','{"jobId":"saved-job","saved":false}');
select pg_temp.check_true((select count(*)=500 from public.saved_jobs where account_id='10000000-0000-0000-0000-000000000001'),'unsaving works at the cap');

reset role;
update public.accounts set suspended=true where id='10000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select pg_temp.check_true(public.workspace_snapshot()->>'suspended'='true' and public.workspace_snapshot()->'savedJobIds'='[]'::jsonb and public.workspace_snapshot()->'savedSearches'='[]'::jsonb,'suspended workspace has empty saved arrays');
select pg_temp.reject($q$select public.workspace_action('savedJob.toggle','{"jobId":"saved-job","saved":true}')$q$,'suspended');
reset role;
rollback;
