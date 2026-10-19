# Saved jobs and job alerts — design

## Goal

Let applicants bookmark vacancies and save job searches with an alerts opt-in, plus build the digest-matching logic that a future email sender will reuse. Actual email delivery is deferred until deployment; this round stores everything and computes matches deterministically.

## Non-goals

- Sending email digests (transport, scheduler, unsubscribe). The sender will be a thin wrapper around `buildDigest`.
- Saved candidates or employer-side bookmarking.
- Push, in-app notification center, or realtime updates.

## Approach

Extend the established workspace pattern: saved state is part of `Workspace`, mutated through the `WorkspaceAction` union, mirrored in demo mode, and enforced by the same checked SQL transaction. Matching logic is extracted into pure functions in `domain.ts`, reusing the exact filters the public jobs page uses today.

## Data model

### TypeScript (`src/lib/types.ts`)

```ts
export type JobFilters = {
  q: string;
  city: string;
  department: string;
  propertyType: string;
  salaryMin: number;
  stay: boolean;
  meals: boolean;
  sort: "newest" | "salary";
};
export type SavedSearch = {
  id: string;
  name: string;
  filters: JobFilters;
  alerts: boolean;
  createdAt: string;
};
```

`Workspace` gains `savedJobIds: string[]` and `savedSearches: SavedSearch[]`. Both are always present in the snapshot (including the suspended minimum workspace), defaulting to `[]`.

New actions:

- `{ action: "savedJob.toggle"; payload: { jobId: string; saved: boolean } }`
- `{ action: "savedSearch.save"; payload: SavedSearch }` (empty `id` creates)
- `{ action: "savedSearch.delete"; payload: { id: string } }`
- `{ action: "savedSearch.alerts"; payload: { id: string; alerts: boolean } }`

### Migration `supabase/migrations/202610190001_saved_jobs.sql`

```sql
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
  filters jsonb not null check (jsonb_typeof(filters) = 'object'),
  alerts boolean not null default true,
  created_at timestamptz not null default now()
);
create index saved_searches_account_idx on public.saved_searches(account_id);
create index saved_jobs_account_idx on public.saved_jobs(account_id);
```

RLS: select only own rows (`account_id = auth.uid()` and `private.is_active()`). Revoke all from `anon`/`authenticated`, then grant select, matching existing tables. All writes stay inside `workspace_action`.

`workspace_snapshot` additions:

- `savedJobIds`: `select coalesce(jsonb_agg(job_id order by created_at desc), '[]') from public.saved_jobs where account_id = uid`
- `savedSearches`: aggregated `{ id, name, filters, alerts, createdAt }` for the account, newest first.
- The suspended early-return shape gains empty arrays for both keys.

### Filter normalization (`private.clean_job_filters`)

Stores exactly the canonical keys; unknown keys dropped:

- `q`, `city`: text, ≤ 200 chars, trimmed.
- `department`: empty or a catalog department; `propertyType`: empty or a catalog property type.
- `salaryMin`: numeric 0–1,000,000,000, integer-safe via existing `number_value`.
- `stay`, `meals`: booleans (default false).
- `sort`: `newest` or `salary` (default `newest`).

### Action branches in `workspace_action`

All require `actor.role = 'applicant'`; generic errors avoid leaking record existence.

- `savedJob.toggle`: validate `jobId` (≤100 chars); when saving, the job must exist and be public or already applied to (`private.public_job` or `private.applied_to`); insert `on conflict do nothing` / delete own row. Cap 500 saved jobs.
- `savedSearch.save`: name trimmed 1–100; filters through `clean_job_filters`. Empty id generates one; non-empty must belong to the account if it exists (update only `where account_id = uid`, else raise). Cap 50 searches on create.
- `savedSearch.delete`: delete own row; missing or foreign row raises a generic error.
- `savedSearch.alerts`: update `alerts` on own row; missing or foreign row raises.

Caps are enforced under `select ... for update` on the account row so concurrent requests serialize and cannot overshoot.

## Domain logic (`src/lib/domain.ts`)

- `jobMatchesFilters(job, companyName, filters): boolean` — single source of truth for the public search: query over title/role/skills/company, city, department, property type, `salaryMin` floor, stay/meals. The `/jobs` page is refactored to use it.
- `describeFilters(filters): string` — human summary for saved-search cards; `defaultSearchName(filters)` derives e.g. "Chef jobs in Pune".
- `filtersFromSearchParams(params)` / `filtersToSearchParams(filters)` — canonical conversion used by `/jobs` and save-search UI.
- `buildDigest(searches, jobs, companies, appliedJobIds, since?)` → `{ searchId, matches: Job[] }[]`. Rules: only public jobs (reuse `publicJobs`), exclude applied jobs, respect each search's filters, skip searches with no matches, a job matching multiple searches appears only under the first search by creation order, optional `since` on `job.createdAt` for the future sender.

## UI

- `src/components/ui.tsx` or job-card: bookmark button on job cards and job detail; `aria-pressed` and label swaps Save/Saved. Anonymous in configured mode navigates to `/login?next=...`; demo mode shows it for the applicant preview only, with the standard "switch to applicant demo" error surfaced otherwise.
- `/jobs` gains "Save this search" when any filter is active → inline form with name prefilled by `defaultSearchName`, alerts on by default; success clears the form.
- New route `/applicant/saved`: saved jobs (reusing `JobCard`) and saved searches with `describeFilters` summary, live match count computed with `jobMatchesFilters`, alerts toggle, delete. Empty states for both sections.
- Applicant nav (`shell.tsx`) gains the saved link.

## Demo parity

- `applyDemoAction` implements all four actions with the same rules, caps, and validation, acting on `demo-applicant`.
- `demo.ts` starts with no saved state.
- `workspace-provider.tsx` normalizes old localStorage snapshots missing the new arrays (`?? []`) instead of resetting the demo.

## Request parsing

`parseAction` (`src/lib/supabase/actions.ts`) accepts the four new actions and validates payload shapes (IDs ≤100 chars, name ≤100 with content, boolean flags strictly boolean, filters object only). Unit tests extend the existing actions test.

## Security and bug checklist

- Owner-only RLS reads; no direct writes to either table; grants follow the revoke-then-select pattern.
- Saving arbitrary or invisible job IDs does not reveal whether they exist (generic error, tested).
- Overwrite protection on `savedSearch.save` via `where account_id = uid` and not-found check after upsert.
- Filter payloads are rebuilt from the canonical shape; no raw client JSONB is stored.
- Caps serialize under an account-row lock.
- Demo provider tolerates legacy persisted state.
- Digest never includes non-public, closed, removed, or already-applied jobs.

## Verification

- Vitest: filter parity, digest (ordering, dedupe, exclusion, `since`), request parsing, demo actions (caps, ownership, validation), React journey (save job, save search, manage saved page).
- PGlite: new `supabase/tests/saved.sql` covering RLS isolation, visibility check on save, caps, filter sanitization, alerts toggle, delete ownership, snapshot keys.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`; smoke script unchanged.
- README and `supabase/README.md` updated with the new actions and the deferred sender note.

## Future sender seam

A deployed cron sender will: load searches with `alerts = true`, compute matches with `buildDigest` (or a mirrored SQL query), render one daily digest email grouped by search, skip accounts with no matches, and record a last-sent marker per search. Nothing in this design blocks that; `createdAt` and `alerts` already exist.
