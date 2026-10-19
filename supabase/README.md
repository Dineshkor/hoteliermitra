# Supabase setup

The unconfigured app runs its local demo. Live persistence uses Supabase Auth, cookie sessions, PostgreSQL row-level security, and transactional RPCs. Only a public publishable key is required; never add a service-role key to this app.

1. Create a Supabase project. Run all SQL files in `migrations/` in filename order in its SQL editor, or apply them with the Supabase CLI (`supabase db push` after linking the project).
2. Copy the project URL and publishable key from the dashboard to `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
   ```

3. In Auth URL Configuration, set Site URL to your application origin (for local development, `http://localhost:3001`). Add `http://localhost:3001/auth/confirm` and your deployed equivalent to Redirect URLs. Restart the app after changing environment variables.
4. Enable email sign-in. All three roles (applicant, employer, admin) sign in with email OTP; include `{{ .Token }}` in the Magic Link email template so users can enter the code. A cookie-safe confirmation link can use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. The confirmation route also accepts PKCE authorization codes and a local `next` path.
5. Phone authentication is not used by this app. The applicant profile's contact phone is stored only as data for employers. Configure SMTP for production email delivery; the built-in email provider has development limits. Configure Auth rate limits and CAPTCHA to suit production traffic.
6. Create your first administrator by signing up normally, then assign its protected account role in the SQL editor:

   ```sql
   update public.accounts set role = 'admin' where id = 'AUTH_USER_UUID';
   ```

Signup metadata accepts only `applicant` or `employer`; `admin` is ignored. Later metadata changes cannot change account roles. Administrators use the same Auth sign-in flow as everyone else. The database owner can restore an account out of band with `update public.accounts set suspended=false, suspension_reason='' where id='AUTH_USER_UUID';` if a suspension is reversed.

## API and data model

`GET /api/workspace` returns `{ workspace }`. Anonymous visitors see approved companies and approved open jobs. Applicants additionally receive their own profile/application snapshots and can track closed or removed jobs they applied to; those historical job records use the submitted approved revision with current status/reason, without exposing pending revisions. Employers receive their owned companies/jobs and `applicationCounts` per job (`total`, `submitted`, `shortlisted`). Employer and administrator workspaces omit full application snapshots; employers fetch candidates through the paginated endpoint. Company contact address, phone, and email are kept in a separately protected table and included only for the owner or administrator. Applicant profiles are never public; employers see only application snapshots submitted to their own jobs.

`POST /api/workspace` accepts the `WorkspaceAction` union in `src/lib/types.ts` and returns `{ workspace }` or `{ error }`. Supported actions are `profile.save`, `company.save`, `job.save`, `job.close`, `application.submit`, `application.status`, `company.review`, `job.review`, `account.suspend`, `savedJob.toggle`, `savedSearch.save`, `savedSearch.delete`, and `savedSearch.alerts`. The route checks request origin and verifies the cookie JWT before reading the body. A capped stream reader enforces 128 KiB of actual bytes even when Content-Length is missing or incorrect, counts multibyte UTF-8 correctly, and cancels oversized streams. PostgreSQL independently checks authentication, active account, role, ownership, payload validity, and status transitions, including when RPCs are called directly.

`GET /api/candidates?jobId=...&page=1` returns `{ applications, total }` for an active employer's owned job, with twelve records per page and database filtering. Optional filters are `status`, `experienceMin`, `experienceMax`, `salaryMax`, `joiningDays`, `city`, `workplace`, `propertyType`, `relocate=true|false`, `screening=pass|fail`, and `sort=newest|experience|salary|joining`. Add `applicationId=...&page=1` to fetch a single candidate detail; matching is constrained to the owned job, so an unrelated application's ID returns no records. The database enforces the same boundaries if `candidate_search` is called directly. Expression indexes support job-specific numeric/range queries. Dashboard counts are computed by PostgreSQL without serializing candidate snapshots into the workspace response.

Companies and jobs can be saved as drafts. A submitted company change returns it to pending moderation. Every job save adds an immutable revision; a pending or rejected revision leaves the previous approved version public until a new revision is approved. Approved jobs from suspended or unapproved companies disappear from public reads. Closing a job stops new applications. Application submission locks the relevant records, validates a complete reusable profile and answers, derives applicant identity and screening results, and captures immutable profile/job/answer snapshots. Failed deal-breakers remain screening flags; they do not automatically reject the application. Employers can shortlist/reject/hire and applicants can withdraw while the application is active. Hired, rejected, and withdrawn applications are terminal. Every status change appends a timestamped event.

The applicant workspace additionally returns `savedJobIds` and `savedSearches`. `saved_jobs` and `saved_searches` grant only owner-scoped RLS reads; all writes go through the checked workspace RPC, which requires an active applicant, locks the account row, enforces caps (500 saved jobs, 50 saved searches), and only allows saving jobs that are currently public or already applied to. Saved search filters are rebuilt from the canonical `JobFilters` shape with a private `clean_job_filters` helper, so unknown keys and hostile values are dropped before storage. Toggling a saved job or search whose row already exists is idempotent, and deleted searches are removed for that owner only. The stored `filters`, `alerts`, and `createdAt` fields are the seam for the deferred digest sender: `buildDigest` in `src/lib/domain.ts` already computes which public, unapplied, newer-than-cursor jobs each alerts-enabled search would email. Sending, scheduling, and unsubscribe handling are intentionally not implemented yet.

Primary applicant/job department and role, company type, and work-history/job property types are checked against hospitality catalogs in PostgreSQL. The embedded suite compares the database catalogs to the UI taxonomy to catch drift. Administrator workspaces additionally contain a minimal account list (`id`, `role`, `name`, `suspended`) for fake-user moderation; other roles cannot enumerate it. Suspension retains records and audit history.

Submitted vacancies require a hospitality property type, employment type, and shift from the form's supported choices. Drafts may leave those fields blank. Submitted companies require business name/type/city/address/description and valid phone/email contacts; approval rechecks completeness even when approving a previously rejected company or reinstating a suspended company. Phone readiness requires ten to fifteen digits after removing formatting, with only an optional leading plus, spaces, and hyphens allowed. The owner's vacancy workspace shows a removal reason independently of prior revision review notes. A suspended account's minimal workspace includes its own `suspensionReason`; anonymous and other users cannot read that reason through the workspace response.

Screening question identifiers are bounded to 100 characters, unique, and cannot use Object.prototype property names such as `constructor`, `__proto__`, or `toString`, including in drafts. A private database trimming helper normalizes boundary whitespace in text fields, lists, screening answers and moderation reasons. It recognizes PostgreSQL whitespace and JavaScript Unicode whitespace, including tabs/newlines, non-breaking spaces and BOM. Required fields and answers cannot pass validation using whitespace-only input; snapshots store normalized answers.

Tables grant authenticated/anonymous users only RLS-protected SELECT. Protected ownership, role, review status, screening output, and snapshots can be written only by checked functions. All SECURITY DEFINER functions use an empty search path and fully qualified references. Internal function privileges are explicitly revoked. Suspended accounts receive a minimal suspension workspace and cannot read their protected records or perform writes. Moderation actions create an audit event.

## Authorization verification

Run the embedded PostgreSQL suite:

```powershell
npm test -- src/lib/supabase/actions.test.ts src/lib/supabase/request-body.test.ts supabase/tests/backend.test.ts
```

The runner uses PGlite (PostgreSQL compiled to WASM), applies the real migrations, provides only `auth.users`, `auth.uid()`, and the `anon`/`authenticated` roles as Supabase shims, then executes every SQL file in `tests/`. The SQL suites switch database roles and JWT identities, assert allowed outcomes, and expect forbidden operations to fail. They cover privilege escalation, ownership, contact privacy, profile drafts/readiness, invalid dates/ranges/questions, derived screening, duplicate submissions, revision visibility, immutable snapshots, status events, moderation auditing, pagination/filtering, taxonomy, suspension, and saved-job/search persistence (`tests/saved.sql` covers owner-only reads, caps, filter sanitization, idempotent toggles, and visibility rules). Each transaction rolls back all fixture data.

To check actual hosted Supabase behavior, run each SQL file in `supabase/tests/` through `psql --set ON_ERROR_STOP=1 --file PATH_TO_TEST.sql` against a disposable migrated Supabase project as its database owner. Do not run fixtures against production. A hosted end-to-end Auth/email check still requires project credentials and configured email delivery; the embedded suite does not simulate Auth HTTP services, cookie rotation, network transport, or concurrent sessions. Closed and removed vacancies cannot be edited or reopened; create a new vacancy instead.

Official setup references: [SSR cookie clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [Phone login](https://supabase.com/docs/guides/auth/phone-login).
