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
('10000000-0000-0000-0000-000000000001','candidate@test.example','{"role":"applicant"}'),
('20000000-0000-0000-0000-000000000001','owner@test.example','{"role":"employer"}'),
('30000000-0000-0000-0000-000000000001','admin@test.example','{"role":"applicant"}');
update public.accounts set role='admin' where id='30000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
select pg_temp.reject($q$select public.workspace_action('company.save','{"id":"space-company","name":"\t","type":"Hotel","city":"\n","address":"\t","description":"\n","phone":"9876543210","email":"hotel@test.example"}')$q$,'Complete company');
select pg_temp.reject($q$select public.workspace_action('company.save','{"id":"space-company","name":"\u00a0","type":"Hotel","city":"Mumbai","address":"10 Test Road","description":"A city hotel","phone":"9876543210","email":"hotel@test.example"}')$q$,'Complete company');
select public.workspace_action('company.save','{"id":"space-company","name":"Whitespace Hotel","type":"Hotel","city":"Mumbai","address":"10 Test Road","description":"A city hotel","phone":"9876543210","email":"hotel@test.example"}');
select pg_temp.reject($q$select public.workspace_action('job.save','{"id":"space-job","companyId":"space-company","title":"\t","department":"Front Office","role":"Receptionist","city":"\n","locality":"\t","propertyType":"Hotel","employmentType":"Full time","shift":"Rotational","description":"\n","salaryMin":10000,"salaryMax":20000}')$q$,'Complete the job');
select public.workspace_action('job.save','{"id":"space-job","companyId":"space-company","title":"Receptionist","department":"Front Office","role":"Receptionist","city":"Mumbai","locality":"Andheri","propertyType":"Hotel","employmentType":"Full time","shift":"Rotational","description":"Welcome guests","salaryMin":10000,"salaryMax":20000,"questions":[{"id":"note","label":"Tell us about service","type":"text","required":true,"dealBreaker":false,"options":[]}]}');
select pg_temp.reject(format('select public.workspace_action(''job.save'',%L::jsonb)',(select data||'{"skills":["\t"]}'::jsonb from public.job_revisions where job_id='space-job' and version=1)::text),'invalid value');
select pg_temp.reject(format('select public.workspace_action(''job.save'',%L::jsonb)',(select data||'{"languages":["\u00a0"]}'::jsonb from public.job_revisions where job_id='space-job' and version=1)::text),'invalid value');
select pg_temp.reject(format('select public.workspace_action(''job.save'',%L::jsonb)',(select data||'{"questions":[{"id":"note","label":"\t","type":"text"}]}'::jsonb from public.job_revisions where job_id='space-job' and version=1)::text),'type and label');
select pg_temp.reject(format('select public.workspace_action(''job.save'',%L::jsonb)',(select data||'{"questions":[{"id":"note","label":"Shift?","type":"choice","options":["\t","Day"]}]}'::jsonb from public.job_revisions where job_id='space-job' and version=1)::text),'invalid value');
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select pg_temp.reject($q$select public.workspace_action('company.review','{"id":"space-company","status":"rejected","reason":"\n"}')$q$,'Provide a reason');
select pg_temp.reject($q$select public.workspace_action('job.review','{"id":"space-job","status":"rejected","reason":"\t\u00a0"}')$q$,'Provide a reason');
select pg_temp.reject($q$select public.workspace_action('account.suspend','{"id":"20000000-0000-0000-0000-000000000001","reason":"\n\t"}')$q$,'Provide a reason');
select public.workspace_action('company.review','{"id":"space-company","status":"approved","reason":""}');
select public.workspace_action('job.review','{"id":"space-job","status":"approved","reason":""}');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select public.workspace_action('profile.save','{"name":"\t","phone":"9876543210","city":"\n","department":"Front Office","role":"Receptionist","experience":0,"languages":[{"name":"English","proficiency":"Fluent"}],"expectedSalary":15000,"noticeDays":0,"availableFrom":"2027-01-01"}');
select pg_temp.reject($q$select public.workspace_action('application.submit','{"jobId":"space-job","answers":{"note":"Service experience"}}')$q$,'Complete your applicant profile');
select pg_temp.reject($q$select public.workspace_action('profile.save','{"languages":[{"name":"\t","proficiency":"\n"}]}')$q$,'Complete every spoken language');
select pg_temp.reject($q$select public.workspace_action('profile.save','{"languages":[{"name":"\u00a0","proficiency":"Fluent"}]}')$q$,'Complete every spoken language');
select public.workspace_action('profile.save',(select data||'{"name":"Candidate","city":"Mumbai"}'::jsonb from public.applicant_profiles));
select pg_temp.reject($q$select public.workspace_action('application.submit','{"jobId":"space-job","answers":{"note":"\n"}}')$q$,'required');
select pg_temp.reject($q$select public.workspace_action('application.submit','{"jobId":"space-job","answers":{"note":"\u00a0"}}')$q$,'required');
select public.workspace_action('application.submit','{"jobId":"space-job","answers":{"note":"\t Hello \u00a0\n"}}');
select pg_temp.check_true((select data->'answers'->>'note'='Hello' from public.applications),'answers normalize boundary whitespace before snapshot');
select pg_temp.reject($q$select private.trim_text('text')$q$,'permission denied');
reset role;
rollback;
