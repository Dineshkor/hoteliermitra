# Saved Jobs and Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Applicants can bookmark vacancies and save filtered searches with a daily-alerts opt-in, backed by checked SQL and demo-mode parity, with digest matching logic ready for a future email sender.

**Architecture:** Extend the workspace pattern — saved state is part of `Workspace`, mutated through the `WorkspaceAction` union via the existing `workspace_action` RPC, mirrored in demo mode. Matching logic is extracted into pure functions in `src/lib/domain.ts`, reusing the filters the public jobs page already applies.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase PostgreSQL (RLS + security-definer functions), PGlite, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-19-saved-jobs-alerts-design.md`

## Global Constraints

- Action names are exactly: `savedJob.toggle`, `savedSearch.save`, `savedSearch.delete`, `savedSearch.alerts`.
- Canonical filter keys are exactly: `q`, `city`, `department`, `propertyType`, `salaryMin`, `stay`, `meals`, `sort` ("newest" | "salary"). Unknown keys are dropped; invalid values raise.
- Caps: 500 saved jobs, 50 saved searches per account. Enforced under `select ... for update` on the account row.
- Migration filename: `supabase/migrations/202610190001_saved_jobs.sql`. New errors use the `HH: ` prefix. No service-role key anywhere.
- SQL: every function uses `security definer set search_path=''`, fully qualified names, explicit revoke/grant like migration 1.
- No code comments; follow existing file patterns; INR/month for salaries; `savedJobIds: string[]` and `savedSearches: SavedSearch[]` are always present on `Workspace` (empty arrays for suspended snapshots).
- Deferred: actual email sending, scheduler, unsubscribe. Do not build them.

## Review Focus

1. Two tabs saving concurrently must not exceed caps or create duplicate saved jobs — account-row lock, idempotent upsert (Task 3 tests duplicate toggle and cap behavior).
2. Old demo localStorage state lacking the new arrays must load, not reset or crash (Task 4 provider test).
3. Anonymous visitor clicking save on a configured build routes to login; it must not silently fail or post (Task 5 test with `role: null`).
4. Hostile filter payloads — unknown keys, wrong types, negative/huge salary, non-catalog department — are normalized or rejected at every layer (Tasks 1, 2, 3 tests).
5. A saved job that later closes, is removed, or loses its approved company must not crash the saved page; it renders an unavailable row with removal (Task 3 visibility rule, Task 6 test).

---

### Task 1: Types, filter helpers, and digest logic

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/domain.ts`
- Modify: `src/lib/demo.ts` (only to add the two empty arrays to `emptyWorkspace` and `createDemo`)
- Test: `src/lib/domain.test.ts`

**Interfaces:**
- Consumes: existing `Job`, `Company` from `types.ts`; `departments`, `propertyTypes`, `salary` from `./taxonomy`.
- Produces (used by all later tasks):
  - `type JobFilters`, `type SavedSearch` in `types.ts`
  - `Workspace.savedJobIds: string[]`, `Workspace.savedSearches: SavedSearch[]`
  - `emptyFilters: JobFilters`, `filtersFromSearchParams(params: ParamReader): JobFilters`, `filtersToSearchParams(filters: JobFilters): URLSearchParams`, `jobMatchesFilters(job: Job, companyName: string | undefined, filters: JobFilters): boolean`, `normalizeJobFilters(input: unknown): JobFilters`, `describeFilters(filters: JobFilters): string`, `defaultSearchName(filters: JobFilters): string`, `buildDigest(searches: SavedSearch[], jobs: Job[], companies: Company[], appliedJobIds: string[], since?: string): { searchId: string; matches: Job[] }[]` in `domain.ts`
  - `type ParamReader = { get(name: string): string | null }`
  - New `WorkspaceAction` members: `savedJob.toggle` `{ jobId: string; saved: boolean }`, `savedSearch.save` `SavedSearch`, `savedSearch.delete` `{ id: string }`, `savedSearch.alerts` `{ id: string; alerts: boolean }`

- [ ] **Step 1: Write the failing tests in `src/lib/domain.test.ts`**

```ts
describe("saved search filters and digest", () => {
  it("round-trips the canonical filter shape through URL params", () => {
    const filters = filtersFromSearchParams(
      new URLSearchParams(
        "q=chef&city=Pune&department=Kitchen&type=Hotel&salary=25000&stay=yes&meals=yes&sort=salary",
      ),
    );
    expect(filters).toEqual({
      q: "chef", city: "Pune", department: "Kitchen", propertyType: "Hotel",
      salaryMin: 25000, stay: true, meals: true, sort: "salary",
    });
    expect(filtersToSearchParams(filters).toString()).toBe(
      "q=chef&city=Pune&department=Kitchen&type=Hotel&salary=25000&stay=yes&meals=yes&sort=salary",
    );
    expect(filtersFromSearchParams(new URLSearchParams("salary=-5&sort=random"))).toEqual(emptyFilters);
  });
  it("normalizes hostile filter input and rejects invalid values", () => {
    expect(
      normalizeJobFilters({ q: " chef ", salaryMin: 20000, sort: "salary", extra: "dropped" }),
    ).toEqual({ ...emptyFilters, q: "chef", salaryMin: 20000, sort: "salary" });
    for (const bad of [
      { department: "Astrology" },
      { propertyType: "Spaceship" },
      { salaryMin: -1 },
      { salaryMin: Number.NaN },
      { salaryMin: 1.5 },
      { q: "x".repeat(201) },
      { stay: "yes" },
      { sort: "popular" },
      null,
    ])
      expect(() => normalizeJobFilters(bad)).toThrow();
  });
  it("matches jobs exactly like the public search filters", () => {
    const demo = createDemo();
    const goa = demo.companies.find((c) => c.id === "palm")!;
    const commis = demo.jobs.find((j) => j.id === "commis-chef")!;
    expect(jobMatchesFilters(commis, goa.name, { ...emptyFilters, department: "Kitchen" })).toBe(true);
    expect(jobMatchesFilters(commis, goa.name, { ...emptyFilters, city: "mumbai" })).toBe(false);
    expect(jobMatchesFilters(commis, goa.name, { ...emptyFilters, stay: true })).toBe(true);
    expect(jobMatchesFilters(commis, goa.name, { ...emptyFilters, salaryMin: 30000 })).toBe(false);
    expect(jobMatchesFilters(commis, goa.name, { ...emptyFilters, q: "palm" })).toBe(true);
  });
  it("builds a digest that excludes applied and non-public jobs and de-duplicates across searches", () => {
    const demo = createDemo();
    const searches: SavedSearch[] = [
      { id: "s1", name: "Kitchen", filters: { ...emptyFilters, department: "Kitchen" }, alerts: true, createdAt: "2026-10-01T00:00:00.000Z" },
      { id: "s2", name: "Goa", filters: { ...emptyFilters, city: "Goa" }, alerts: true, createdAt: "2026-10-02T00:00:00.000Z" },
      { id: "s3", name: "Kitchen again", filters: { ...emptyFilters, department: "Kitchen" }, alerts: true, createdAt: "2026-10-03T00:00:00.000Z" },
    ];
    const digest = buildDigest(searches, demo.jobs, demo.companies, ["commis-chef"]);
    expect(digest).toHaveLength(1);
    expect(digest[0].searchId).toBe("s1");
    expect(digest[0].matches.map((j) => j.id)).toEqual(["sous-chef"]);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(buildDigest(searches, demo.jobs, demo.companies, [], future)).toEqual([]);
  });
  it("describes filters and derives search names", () => {
    const filters: JobFilters = { ...emptyFilters, department: "Kitchen", city: "Pune", salaryMin: 20000, stay: true };
    expect(describeFilters(filters)).toContain("Kitchen");
    expect(describeFilters(filters)).toContain("Stay provided");
    expect(defaultSearchName(filters)).toBe("Kitchen jobs in Pune");
    expect(defaultSearchName(emptyFilters)).toBe("Hospitality jobs");
  });
});
```

Add the new imports at the top of the file and mirror the filter conditions from `src/components/pages/public.tsx` `Jobs()` (query over title/role/skills/company name, case-insensitive city, department/propertyType equality, `salaryMin` floor, stay/meals).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/domain.test.ts`
Expected: FAIL — `filtersFromSearchParams` is not exported.

- [ ] **Step 3: Implement types and helpers**

In `types.ts` add `JobFilters` and `SavedSearch` exactly as in the spec, add the fields to `Workspace`, and extend `WorkspaceAction`. In `domain.ts` implement the helpers. `buildDigest`: visible = `publicJobs(jobs, companies)` minus applied minus `createdAt <= since`; sort searches by `createdAt` ascending; assign each visible job to the first matching search; skip empty results. In `demo.ts` add `savedJobIds: []` and `savedSearches: []` to `emptyWorkspace` and the `createDemo` return.

- [ ] **Step 4: Run the full suite to verify they pass and nothing else broke**

Run: `npx vitest run src/lib`
Expected: PASS. Fix any compile fallout from the new required `Workspace` fields.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/domain.ts src/lib/demo.ts src/lib/domain.test.ts
git commit -m "feat: add saved search filters and digest matching logic"
```

### Task 2: Request-boundary parsing

**Files:**
- Modify: `src/lib/supabase/actions.ts`
- Test: `src/lib/supabase/actions.test.ts`

**Interfaces:**
- Consumes: `WorkspaceAction` additions from Task 1.
- Produces: `parseAction` accepts the four new actions; nothing else changes.

- [ ] **Step 1: Write the failing tests**

Add to the "workspace request boundary" describe block:

```ts
it("accepts the saved actions and rejects malformed payloads", () => {
  expect(
    parseAction({ action: "savedJob.toggle", payload: { jobId: "commis-chef", saved: true } }),
  ).toEqual({ action: "savedJob.toggle", payload: { jobId: "commis-chef", saved: true } });
  expect(
    parseAction({
      action: "savedSearch.save",
      payload: { id: "", name: "Kitchen jobs", filters: {}, alerts: true, createdAt: "2026-10-19T00:00:00.000Z" },
    }),
  ).toMatchObject({ action: "savedSearch.save" });
  expect(
    parseAction({ action: "savedSearch.alerts", payload: { id: "s1", alerts: false } }),
  ).toEqual({ action: "savedSearch.alerts", payload: { id: "s1", alerts: false } });
  for (const bad of [
    { action: "savedJob.toggle", payload: { jobId: "j", saved: "yes" } },
    { action: "savedJob.toggle", payload: { jobId: "", saved: true } },
    { action: "savedSearch.save", payload: { name: " ", filters: {}, alerts: true } },
    { action: "savedSearch.save", payload: { name: "x".repeat(101), filters: [], alerts: true } },
    { action: "savedSearch.save", payload: { name: "ok", filters: {}, alerts: "on" } },
    { action: "savedSearch.alerts", payload: { id: "s1", alerts: "off" } },
    { action: "savedSearch.delete", payload: {} },
  ])
    expect(() => parseAction(bad)).toThrow();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/supabase/actions.test.ts`
Expected: FAIL — "Unsupported action".

- [ ] **Step 3: Implement**

Add the four actions to the set; add `savedSearch.delete`/`savedSearch.alerts` to the ID-validated list; validate `savedJob.toggle` (`jobId` string 1–100, `saved` strictly boolean), and `savedSearch.save` (`name` trimmed 1–100, `filters` object, `alerts` strictly boolean, optional `id` string ≤100). Use exact error strings, e.g. "Invalid saved job", "Invalid saved search".

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/supabase/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/actions.ts src/lib/supabase/actions.test.ts
git commit -m "feat: validate saved job and search actions at the request boundary"
```

### Task 3: SQL tables, actions, snapshot, and PGlite verification

**Files:**
- Create: `supabase/tests/saved.sql`
- Create: `supabase/migrations/202610190001_saved_jobs.sql`

**Interfaces:**
- Consumes: `private.text_value`, `private.number_value`, `private.bool_value`, `private.public_job`, `private.applied_to`, `private.is_active`, `public.workspace_snapshot()`, `public.workspace_action(text,jsonb)` from migration 1.
- Produces: tables `public.saved_jobs`, `public.saved_searches`; `private.clean_job_filters(jsonb) returns jsonb`; updated `workspace_snapshot` (adds `savedJobIds`, `savedSearches` to both the normal and suspended shapes); updated `workspace_action` with the four branches.

- [ ] **Step 1: Write `supabase/tests/saved.sql` (failing)**

Use the `pg_temp.check_true` / `pg_temp.reject` conventions from `supabase/tests/candidates.sql`. Fixtures: applicants `10000000-…-01` and `…-02`, employer `20000000-…-01`, approved company/job, a pending job, and a removed job. Assert:

```sql
-- as applicant A (set local role authenticated; set_config sub to A's uuid)
-- A can save a public job and see it in the snapshot
select public.workspace_action('savedJob.toggle','{"jobId":"saved-job","saved":true}');
select pg_temp.check_true((public.workspace_snapshot()->'savedJobIds')?'saved-job','saved job id is in the snapshot');
-- idempotent: saving twice leaves one row
select public.workspace_action('savedJob.toggle','{"jobId":"saved-job","saved":true}');
select pg_temp.check_true((select count(*)=1 from public.saved_jobs where job_id='saved-job'),'duplicate save is idempotent');
-- pending and removed jobs cannot be saved; non-boolean flag rejected
select pg_temp.reject($q$select public.workspace_action('savedJob.toggle','{"jobId":"pending-job","saved":true}')$q$,'not available');
select pg_temp.reject($q$select public.workspace_action('savedJob.toggle','{"jobId":"removed-job","saved":true}')$q$,'not available');
select pg_temp.reject($q$select public.workspace_action('savedJob.toggle','{"jobId":"saved-job","saved":"yes"}')$q$,'true or false');
-- saved search lifecycle and sanitization
select public.workspace_action('savedSearch.save','{"id":"","name":" Weekend chefs ","filters":{"q":"chef","department":"Kitchen","salaryMin":20000,"sort":"salary","unknown":"dropped"},"alerts":true}');
select pg_temp.check_true((select name='Weekend chefs' and filters='{"q":"chef","city":"","department":"Kitchen","propertyType":"","salaryMin":20000,"stay":false,"meals":false,"sort":"salary"}'::jsonb and alerts from public.saved_searches where account_id=auth.uid()),'search is trimmed, canonical and alerting');
select pg_temp.reject($q$select public.workspace_action('savedSearch.save','{"id":"","name":"Bad","filters":{"department":"Astrology"},"alerts":true}')$q$,'valid department');
-- B cannot see or edit A's rows (switch sub to B)
select pg_temp.check_true((select count(*) from public.saved_jobs)=0,'saved jobs are private');
select pg_temp.reject($q$insert into public.saved_jobs(account_id,job_id) values(auth.uid(),'saved-job')$q$,'permission denied');
select pg_temp.reject($q$select public.workspace_action('savedSearch.alerts',jsonb_build_object('id',(select id from public.saved_searches limit 1),'alerts',false))$q$,'not found');
-- back as A: toggle alerts, delete, then confirm the rows are gone
select public.workspace_action('savedSearch.alerts',jsonb_build_object('id',(select id from public.saved_searches where account_id=auth.uid()),'alerts',false));
select public.workspace_action('savedSearch.delete',jsonb_build_object('id',(select id from public.saved_searches where account_id=auth.uid())));
-- reset role: seed 500 saved jobs and 50 searches for A directly, then (as A again) reject the next save
-- suspended applicant: set suspended=true; snapshot has empty arrays and both writes above are rejected
```

The test file runs inside the existing `begin … rollback` transaction like its siblings. Only the SQL test file changes — `backend.test.ts` picks it up automatically.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run supabase/tests/backend.test.ts`
Expected: FAIL — `relation "public.saved_jobs" does not exist` or "Unsupported action".

- [ ] **Step 3: Write the migration**

`supabase/migrations/202610190001_saved_jobs.sql`:

1. Tables and indexes exactly as the spec shows, plus `alter table … enable row level security`, owner-only select policies using `private.is_active() and account_id=auth.uid()`, and `revoke all … from anon,authenticated; grant select …`.
2. `private.clean_job_filters(p jsonb) returns jsonb` — rebuilds the canonical object with `private.text_value` (`q`, `city` ≤200), department/propertyType catalog checks (mirror the messages in `private.check_hospitality`/`private.check_property`), `salaryMin` via `private.number_value` plus an integer check (`mod(salary,1)<>0` → raise), booleans via `private.bool_value`, `sort` in `('newest','salary')` defaulting to `newest`. `create function` (not replace), `immutable set search_path=''`.
3. `create or replace function public.workspace_snapshot()` — copy migration 1's body; declare `saved_job_ids jsonb; saved_searches jsonb;`; add the two selects (`order by created_at desc`); add `'savedJobIds'`/`'savedSearches'` to the final `jsonb_build_object` and to the suspended early return (both `'[]'::jsonb`).
4. `create or replace function public.workspace_action(action text,payload jsonb)` — copy migration 1's body; add `search_name text; alerts_on boolean;` to the declarations; insert four branches before `elsif action in ('company.review','job.review','account.suspend')`:

```sql
elsif action='savedJob.toggle' then
  if actor.role<>'applicant' then raise exception 'HH: Applicant access is required.'; end if;
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
  identifier:=private.text_value(payload,'id',100);
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
  update public.saved_searches set alerts=private.bool_value(payload,'alerts') where id=identifier and account_id=uid;
  if not found then raise exception 'HH: Search not found.'; end if;
```

5. Re-state the final `revoke all on public.saved_jobs,public.saved_searches …`/grants and `revoke all on function public.workspace_snapshot(),public.workspace_action(text,jsonb) from public,anon,authenticated; grant execute …` exactly as migration 1 does.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run supabase/tests/backend.test.ts`
Expected: PASS, including all pre-existing SQL tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202610190001_saved_jobs.sql supabase/tests/saved.sql
git commit -m "feat: persist saved jobs and searches with protected transactions"
```

### Task 4: Demo parity and legacy-state normalization

**Files:**
- Modify: `src/lib/demo-actions.ts`
- Modify: `src/components/workspace-provider.tsx` (demo reload branch only)
- Test: `src/lib/demo-actions.test.ts`, `src/components/workspace-provider.test.tsx`

**Interfaces:**
- Consumes: `normalizeJobFilters`, action payloads from Task 1; `applyDemoAction` shape from the existing file.
- Produces: demo behavior identical to SQL (caps 500/50, visibility rule, ownership); provider tolerates persisted state without the new arrays.

- [ ] **Step 1: Write the failing tests**

In `src/lib/demo-actions.test.ts` add a describe block: toggle saves `commis-chef` (visible) but rejects `pending-cook` ("not available"); rejects `saved: true` for demo employer role with the existing "Switch to the applicant demo" error; caps at 500 (`{ ...createDemo(), savedJobIds: Array.from({length: 500}, (_, i) => `job-${i}`) }` then toggle rejects with "up to 500"); `savedSearch.save` trims the name, normalizes filters (unknown keys dropped, defaults filled), updates an existing id in place, and rejects an invalid department; `savedSearch.delete` and `savedSearch.alerts` reject a foreign/unknown id with "Search not found."; deleting removes the search. In `src/components/workspace-provider.test.tsx` add: seed `localStorage` with a v2-era JSON state lacking `savedJobIds`/`savedSearches`, render in demo mode, expect both arrays to exist after load (and the demo not to be reset).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/demo-actions.test.ts src/components/workspace-provider.test.tsx`
Expected: FAIL — actions throw (unknown action currently falls through and returns unchanged state, so assert on expected messages).

- [ ] **Step 3: Implement**

Add the four branches to `applyDemoAction` mirroring the SQL rules (applicant role via `requireRole("applicant")`, visibility = approved job with approved company or an existing application by `demo-applicant`, caps, id-based ownership for search update/delete/alerts, `normalizeJobFilters`, name trimmed 1–100, `createdAt` preserved on update). In the provider's demo reload branch, after JSON.parse, normalize:

```ts
next = {
  ...next,
  savedJobIds: Array.isArray(next.savedJobIds) ? next.savedJobIds : [],
  savedSearches: Array.isArray(next.savedSearches) ? next.savedSearches : [],
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/demo-actions.test.ts src/components/workspace-provider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/demo-actions.ts src/components/workspace-provider.tsx src/lib/demo-actions.test.ts src/components/workspace-provider.test.tsx
git commit -m "feat: mirror saved jobs and searches in demo mode"
```

### Task 5: Save button, filters refactor, and save-search UI

**Files:**
- Modify: `src/components/job-card.tsx` (add `SaveJobButton`)
- Create: `src/components/save-search.tsx`
- Modify: `src/components/pages/public.tsx` (`Jobs()` uses the helpers; `JobDetail` renders the button; `Jobs` renders `SaveSearchBar`)
- Test: `src/components/journey.test.tsx`

**Interfaces:**
- Consumes: Task 1 helpers; Task 2/4 actions; `useWorkspace`, `useTask`, `Field`, `Button`, `Notice` from `./ui`.
- Produces: `SaveJobButton({ jobId }: { jobId: string })` exported from `job-card.tsx`; `SaveSearchBar({ filters }: { filters: JobFilters })` exported from `save-search.tsx`.

- [ ] **Step 1: Write the failing journey tests**

Follow the existing `Harness`/`nav` conventions in `journey.test.tsx`:

```tsx
it("saves a job and manages it from the saved page", async () => {
  nav.url = "/jobs";
  render(<Harness state={createDemo()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Save job" }));
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Saved job" }).length).toBeGreaterThan(0),
  );
  nav.push("/applicant/saved");
  expect(await screen.findByText("Commis Chef · Indian Cuisine")).toBeTruthy();
});
it("routes anonymous visitors to sign in instead of saving", () => {
  render(<Harness state={{ ...emptyWorkspace, role: null, userId: null }} />);
  expect(screen.getByRole("link", { name: "Sign in to save this job" }).getAttribute("href")).toContain("/login");
});
it("saves the current search with a name and alerts on", async () => {
  nav.url = "/jobs?department=Kitchen";
  render(<Harness state={createDemo()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Save this search" }));
  await userEvent.clear(screen.getByLabelText("Search name"));
  await userEvent.type(screen.getByLabelText("Search name"), "Kitchen roles");
  await userEvent.click(screen.getByRole("button", { name: "Save search" }));
  expect(await screen.findByText(/Search saved/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/journey.test.tsx`
Expected: FAIL — no button named "Save job".

- [ ] **Step 3: Implement**

`SaveJobButton`: role `applicant` → toggle button (`Bookmark` icon, `aria-pressed`, labels "Save job"/"Saved job", `useTask` for busy/error); role `null` → link to `/login?next=<encoded pathname>` with accessible name "Sign in to save this job"; any other role → render nothing. `JobCard` renders it in `job-card-top`; `JobDetail` renders it beside the apply action.

Refactor `Jobs()`: `const filters = filtersFromSearchParams(params)` and filter via `jobMatchesFilters(j, company?.name, filters)`; keep the existing sort logic driven by `filters.sort` and the `update` helper writing the same param names.

`save-search.tsx`: applicant-only (same role rules as the button); hidden when `filters` equal `emptyFilters`; a "Save this search" button opens an inline form (accessible input label "Search name", default `defaultSearchName(filters)`), submit dispatches `savedSearch.save` with `{ id: "", name, filters, alerts: true, createdAt: new Date().toISOString() }`, success shows "Search saved. Daily alerts are on." with a link to `/applicant/saved`.

- [ ] **Step 4: Run to verify pass plus existing journeys**

Run: `npx vitest run src/components/journey.test.tsx src/components/login.test.tsx src/components/workspace-provider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/job-card.tsx src/components/save-search.tsx src/components/pages/public.tsx src/components/journey.test.tsx
git commit -m "feat: save jobs and searches from public browsing"
```

### Task 6: Saved page, route, and navigation

**Files:**
- Modify: `src/components/pages/applicant.tsx` (add `Saved`)
- Modify: `src/components/route-view.tsx`
- Create: `src/app/applicant/saved/page.tsx`
- Modify: `src/components/shell.tsx`
- Modify: `src/app/globals.css` (only if existing classes cannot express the search cards)
- Test: `src/components/journey.test.tsx`

**Interfaces:**
- Consumes: Task 1 helpers (`jobMatchesFilters`, `describeFilters`, `filtersToSearchParams`), Task 4 actions, `Guard`, `JobCard`, `SaveJobButton` rules.
- Produces: `/applicant/saved` route; applicant nav links.

- [ ] **Step 1: Write the failing journey tests**

```tsx
it("manages saved searches with match counts and alerts toggles", async () => {
  const state = createDemo();
  state.savedSearches = [{ id: "s1", name: "Kitchen roles", filters: { ...emptyFilters, department: "Kitchen" }, alerts: true, createdAt: new Date().toISOString() }];
  nav.url = "/applicant/saved";
  render(<Harness state={state} />);
  expect(await screen.findByText("Kitchen roles")).toBeTruthy();
  expect(screen.getByText(/2 matches?/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Alerts on" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Alerts off" })).toBeTruthy());
  await userEvent.click(screen.getByRole("button", { name: "Delete search" }));
  await waitFor(() => expect(screen.queryByText("Kitchen roles")).toBeNull());
});
it("shows an unavailable row for a saved job that is no longer public", async () => {
  const state = createDemo();
  state.savedJobIds = ["ghost-job"];
  nav.url = "/applicant/saved";
  render(<Harness state={state} />);
  expect(await screen.findByText("Vacancy no longer available")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Remove from saved" }));
  await waitFor(() => expect(screen.queryByText("Vacancy no longer available")).toBeNull());
});
```

Match count expectation for Kitchen: demo has `commis-chef`, `sous-chef` approved (pending-cook excluded via `publicJobs`).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/journey.test.tsx`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement**

`Saved` component under `Guard role="applicant"` with `PageHeading` "Saved jobs". Saved-jobs section: map `state.savedJobIds`, look up `state.jobs`; found → `JobCard` with `SaveJobButton`; missing → a card titled "Vacancy no longer available" with a "Remove from saved" button dispatching `savedJob.toggle` `{ jobId, saved: false }`. Saved-searches section: name, `describeFilters`, live count from `publicJobs` + `jobMatchesFilters`, alerts toggle button (accessible names "Alerts on"/"Alerts off", dispatches `savedSearch.alerts`), "Delete search" (dispatches `savedSearch.delete`), and an "Open search" link to `/jobs?${filtersToSearchParams(filters)}`. Empty states with links to `/jobs`. Route: `if (p.length === 2 && p[1] === "saved") return <Saved />;` inside the applicant block; add `src/app/applicant/saved/page.tsx` (`metadata.title = "Saved Jobs"`, `dynamic = "force-dynamic"`, renders `<Saved />`). Shell: applicant desktop links gain `["/applicant/saved", "Saved jobs"]`; mobile menu inherits `links`; mobile bottom nav gains a Saved link with the `Bookmark` icon.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/journey.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/pages/applicant.tsx src/components/route-view.tsx src/app/applicant/saved/page.tsx src/components/shell.tsx src/app/globals.css src/components/journey.test.tsx
git commit -m "feat: add the saved jobs and searches page"
```

### Task 7: Documentation and full verification

**Files:**
- Modify: `README.md`, `supabase/README.md`

- [ ] **Step 1: Update docs**

README "What is implemented": one bullet for saved jobs, saved searches, and the daily-alerts opt-in; note in the limits/future area that digest email sending, scheduler, and unsubscribe are deferred until deployment. `supabase/README.md`: add the four actions to the `WorkspaceAction` list, describe `saved_jobs`/`saved_searches` and their RLS, and note the deferred sender seam (`buildDigest` + `alerts` + `createdAt`).

- [ ] **Step 2: Full verification**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all pass; update the README verification record with the actual counts. If a local server is running unconfigured on port 3001, also run `npm run test:smoke`.

- [ ] **Step 3: Commit**

```bash
git add README.md supabase/README.md
git commit -m "docs: record saved jobs and deferred alert delivery"
```
