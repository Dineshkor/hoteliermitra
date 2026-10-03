begin;
create or replace function pg_temp.check_true(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message; end if; end $$;
create or replace function pg_temp.reject(statement text,fragment text) returns void language plpgsql as $$
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
('10000000-0000-0000-0000-000000000001','first@test.example','{"role":"applicant"}'),
('10000000-0000-0000-0000-000000000002','second@test.example','{"role":"applicant"}'),
('20000000-0000-0000-0000-000000000001','owner@test.example','{"role":"employer"}'),
('30000000-0000-0000-0000-000000000001','admin@test.example','{"role":"applicant"}');
update public.accounts set role='admin' where id='30000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
select public.workspace_action('company.save','{"id":"screen-company","name":"Screen Hotel","type":"Hotel","city":"Mumbai","address":"10 Test Road","description":"A city hotel","phone":"9876543210","email":"hotel@test.example"}');
select public.workspace_action('job.save','{"id":"screen-job","companyId":"screen-company","title":"Receptionist","department":"Front Office","role":"Receptionist","city":"Mumbai","locality":"Andheri","propertyType":"Hotel","employmentType":"Full time","experienceMin":0,"experienceMax":null,"salaryMin":20000,"salaryMax":40000,"shift":"Rotational","accommodation":false,"meals":false,"openings":1,"description":"Welcome guests","skills":[],"languages":[],"joiningBy":"","questions":[{"id":"minimum","label":"Years of experience?","type":"number","required":true,"dealBreaker":true,"expected":"5","comparison":"minimum","options":[]},{"id":"maximum","label":"Salary expected?","type":"number","required":true,"dealBreaker":true,"expected":"30000","comparison":"maximum","options":[]},{"id":"equal","label":"Notice period?","type":"number","required":true,"dealBreaker":true,"expected":"30","comparison":"equal","options":[]},{"id":"choice","label":"Shift?","type":"choice","required":true,"dealBreaker":true,"expected":"Morning","comparison":"equal","options":["Morning","Night"]},{"id":"text","label":"Anything else?","type":"text","required":false,"dealBreaker":false,"expected":"","comparison":"equal","options":[]}],"status":"pending"}');
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select public.workspace_action('company.review','{"id":"screen-company","status":"approved","reason":""}');
select public.workspace_action('job.review','{"id":"screen-job","status":"approved","reason":"Old approval note"}');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select public.workspace_action('profile.save','{"name":"First Candidate","phone":"9876543210","city":"Mumbai","department":"Front Office","role":"Receptionist","experience":0,"languages":[{"name":"English","proficiency":"Fluent"}],"expectedSalary":25000,"noticeDays":30,"availableFrom":"2027-01-01"}');
select pg_temp.reject($q$select public.workspace_action('application.submit','{"jobId":"screen-job","answers":{"minimum":"x","maximum":"25000","equal":"30","choice":"Morning"}}')$q$,'numeric');
select pg_temp.reject($q$select public.workspace_action('application.submit','{"jobId":"screen-job","answers":{"minimum":"1e1000000","maximum":"25000","equal":"30","choice":"Morning"}}')$q$,'numeric');
select pg_temp.reject($q$select public.workspace_action('application.submit','{"jobId":"screen-job","answers":{"minimum":5,"maximum":"25000","equal":"30","choice":"Morning"}}')$q$,'text');
select pg_temp.reject($q$select public.workspace_action('application.submit','{"jobId":"screen-job","answers":{"minimum":"5","maximum":"25000","equal":"30","choice":"Evening"}}')$q$,'choices');
select public.workspace_action('application.submit','{"jobId":"screen-job","answers":{"minimum":"3","maximum":"35000","equal":"15","choice":"Night","text":"Hello"}}');
select pg_temp.check_true((select status='submitted' and (data->'screening'->0->>'passed')::boolean=false and (data->'screening'->1->>'passed')::boolean=false and (data->'screening'->2->>'passed')::boolean=false and (data->'screening'->3->>'passed')::boolean=false and data->'screening'->4->'passed'='null'::jsonb from public.applications),'numeric minimum/maximum/equal and choice derive failed flags without autorejection');
select public.workspace_action('application.status',jsonb_build_object('id',(select id from public.applications),'status','withdrawn'));
select pg_temp.check_true((select status='withdrawn' and jsonb_array_length(data->'events')=2 from public.applications),'applicant can withdraw own active application');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select public.workspace_action('profile.save','{"name":"Second Candidate","phone":"9876543210","city":"Mumbai","department":"Front Office","role":"Receptionist","experience":0,"languages":[{"name":"English","proficiency":"Fluent"}],"expectedSalary":25000,"noticeDays":30,"availableFrom":"2027-01-01"}');
select public.workspace_action('application.submit','{"jobId":"screen-job","answers":{"minimum":"1e1","maximum":"25000","equal":"30","choice":"Morning"}}');
select pg_temp.check_true((select (data->'screening'->0->>'passed')::boolean and (data->'screening'->1->>'passed')::boolean and (data->'screening'->2->>'passed')::boolean and (data->'screening'->3->>'passed')::boolean and data->'screening'->4->'passed'='null'::jsonb from public.applications),'numeric criteria pass and omitted optional text remains unknown');
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
select pg_temp.reject(format('select public.workspace_action(''application.status'',%L::jsonb)',jsonb_build_object('id',(select id from public.applications where status='withdrawn'),'status','hired')::text),'cannot change');
select public.workspace_action('application.status',jsonb_build_object('id',(select id from public.applications where status='submitted'),'status','hired'));
select pg_temp.reject(format('select public.workspace_action(''application.status'',%L::jsonb)',jsonb_build_object('id',(select id from public.applications where status='hired'),'status','shortlisted')::text),'cannot change');
select public.workspace_action('job.save',(select data||'{"title":"Rejected Revision","status":"pending"}'::jsonb from public.job_revisions where job_id='screen-job' and version=1));
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select public.workspace_action('job.review','{"id":"screen-job","status":"rejected","reason":"Needs clearer requirements"}');
select pg_temp.check_true(public.workspace_snapshot()->'jobs'->0->>'title'='Receptionist' and public.workspace_snapshot()->'jobs'->0->'pendingRevision'->>'status'='rejected','rejected revision preserves old approved content');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.check_true(public.workspace_snapshot()->'jobs'->0->>'title'='Receptionist','anonymous retains approved content after rejection');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select public.workspace_action('job.review','{"id":"screen-job","status":"removed","reason":"Safety removal reason"}');
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
select pg_temp.check_true(public.workspace_snapshot()->'jobs'->0->>'status'='removed' and public.workspace_snapshot()->'jobs'->0->>'reviewReason'='Safety removal reason','owner sees removal reason instead of old approval reason');
select pg_temp.check_true(public.workspace_snapshot()->'jobs'->0->'pendingRevision'->>'reviewReason'='Safety removal reason','removal reason also overrides pending revision review reason');
select pg_temp.check_true((select review_reason='Old approval note' from public.job_revisions where job_id='screen-job' and version=1),'removal preserves prior approved revision reason');
reset role;
insert into auth.users(id,email,raw_user_meta_data) values('10000000-0000-0000-0000-000000000003','unrelated@test.example','{"role":"applicant"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select pg_temp.check_true(public.workspace_snapshot()->'jobs'->0->>'status'='removed' and public.workspace_snapshot()->'jobs'->0->>'reviewReason'='Safety removal reason' and public.workspace_snapshot()->'jobs'->0->'pendingRevision' is null,'applied applicant tracks removal reason without seeing pending revisions');
select pg_temp.check_true((select count(*)=1 from public.jobs) and (select count(*)=1 and min(version)=1 from public.job_revisions),'removed job RLS exposes only applied approved revision');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select pg_temp.check_true(jsonb_array_length(public.workspace_snapshot()->'jobs')=0 and (select count(*)=0 from public.jobs),'unrelated applicant cannot see removed job');
reset role;
rollback;
