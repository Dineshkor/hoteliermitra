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
('20000000-0000-0000-0000-000000000001','owner@test.example','{"role":"employer"}'),
('30000000-0000-0000-0000-000000000001','admin@test.example','{"role":"applicant"}');
update public.accounts set role='admin' where id='30000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
select public.workspace_action('company.save','{"id":"incomplete-company","status":"draft"}');
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select public.workspace_action('company.review','{"id":"incomplete-company","status":"rejected","reason":"Complete your business details"}');
select pg_temp.reject($q$select public.workspace_action('company.review','{"id":"incomplete-company","status":"approved","reason":""}')$q$,'Complete company');
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
select public.workspace_action('company.save','{"id":"complete-company","name":"Complete Hotel","type":"Hotel","city":"Mumbai","address":"10 Test Road","description":"A city hotel with a guest service team","phone":"+91 98765-43210","email":"hotel@example.com"}');
select pg_temp.reject($q$select public.workspace_action('company.save','{"id":"missing-address","name":"Hotel","type":"Hotel","city":"Mumbai","description":"A city hotel","phone":"9876543210","email":"hotel@example.com"}')$q$,'Complete company');
select pg_temp.reject($q$select public.workspace_action('company.save','{"id":"missing-description","name":"Hotel","type":"Hotel","city":"Mumbai","address":"10 Test Road","phone":"9876543210","email":"hotel@example.com"}')$q$,'Complete company');
select pg_temp.reject($q$select public.workspace_action('company.save','{"id":"bad-phone","name":"Hotel","type":"Hotel","city":"Mumbai","address":"10 Test Road","description":"A city hotel","phone":"----------","email":"hotel@example.com"}')$q$,'Complete company');
select pg_temp.reject($q$select public.workspace_action('company.save','{"id":"bad-phone","name":"Hotel","type":"Hotel","city":"Mumbai","address":"10 Test Road","description":"A city hotel","phone":"98765-4321","email":"hotel@example.com"}')$q$,'Complete company');
select pg_temp.reject($q$select public.workspace_action('company.save','{"id":"bad-phone","name":"Hotel","type":"Hotel","city":"Mumbai","address":"10 Test Road","description":"A city hotel","phone":"1234567890123456","email":"hotel@example.com"}')$q$,'Complete company');
select pg_temp.reject($q$select public.workspace_action('company.save','{"id":"bad-email","name":"Hotel","type":"Hotel","city":"Mumbai","address":"10 Test Road","description":"A city hotel","phone":"9876543210","email":"not-an-email"}')$q$,'Complete company');
select pg_temp.reject($q$select public.workspace_action('company.save','{"id":"bad-email","name":"Hotel","type":"Hotel","city":"Mumbai","address":"10 Test Road","description":"A city hotel","phone":"9876543210","email":"a@@example.com"}')$q$,'Complete company');
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select public.workspace_action('company.review','{"id":"complete-company","status":"rejected","reason":"Additional verification"}');
select public.workspace_action('company.review','{"id":"complete-company","status":"approved","reason":"Verification complete"}');
select pg_temp.check_true((select status='approved' from public.companies where id='complete-company'),'complete rejected company can be approved');
select public.workspace_action('company.review','{"id":"complete-company","status":"suspended","reason":"Re-check business"}');
select public.workspace_action('company.review','{"id":"complete-company","status":"approved","reason":"Reinstated"}');
select pg_temp.check_true((select status='approved' from public.companies where id='complete-company'),'complete suspended company can be reinstated');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.check_true((select count(*)=1 from public.companies),'only complete approved company is public');
reset role;
rollback;
