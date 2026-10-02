# Hospitality hiring implementation plan

> For agentic workers: execute the following bounded tasks with superpowers:subagent-driven-development; review specification compliance before code quality. The user has approved the design and authorized implementation. The newly requested project directory provides isolation; there is no existing repository to create a worktree from.

**Goal:** Deliver a runnable hospitality hiring MVP with real Supabase integration and an explicitly labelled local demonstration when Supabase is unconfigured.

**Architecture:** Next.js App Router with server-checked Supabase sessions, protected PostgreSQL functions for mutations, and RLS. A typed workspace adapter shares the UI between local demo data and authenticated API responses; demo persistence is confined to the browser and never used in configured production mode.

**Tech stack:** Next.js 16, React 19, TypeScript, CSS, Lucide, Supabase JS/SSR, Vitest.

## File responsibilities

- `src/lib/types.ts`: common UI/API contract for roles, structured jobs, applicants, screening, applications, companies, workspace, and actions.
- `src/lib/domain.ts`, `src/lib/domain.test.ts`: profile/job validation, deterministic screening, fit indicators, candidate filtering, status transitions.
- `src/lib/demo.ts`: entirely fictional development listings and applicants; no claims of real users or openings.
- `src/components/workspace-provider.tsx`: local demo persistence or authenticated workspace API access; all mutation failures surfaced to the user.
- `src/components/ui.tsx`, `shell.tsx`, `job-card.tsx`: reusable accessible controls, responsive navigation, cards.
- `src/components/pages/*`: separate search, detail, profile, employer vacancies, applicants, moderation, and authentication flows.
- `src/app/*/page.tsx`: route composition; `layout.tsx`, `globals.css` own the visual system.
- `src/lib/supabase/*`, `src/proxy.ts`, `src/app/api/workspace/route.ts`: session refresh, public reads, role-aware reads and mutations.
- `supabase/migrations/202610020001_mvp.sql`: normalized ownership/version columns, profile/work history, application snapshots, RLS, transactional functions, moderation events.
- `supabase/tests/authorization.sql`: runnable authorization and transactional regression checks on a fresh local database.
- `README.md`: local startup, Supabase setup, authentication provider requirements, privately assigned admin, testing and deployment instructions.

## Task 1 — foundation and domain

- [ ] Install dependencies with `npm install --cache D:\nextjs\.npm-cache` and create an isolated feature branch.
- [ ] Define the typed contract. Application snapshots contain the applicant profile, answers, and the job version used at submission. Company and job review state cannot be set by employer UI actions.
- [ ] Write failing Vitest cases for: salary range validation, experienced applicant missing work history, unanswered mandatory questions, numeric/choice screening criteria, immutable snapshots, candidate filters, and invalid status changes. Run `npm test` and confirm missing behavior causes failures.
- [ ] Implement the domain functions and run `npm test` until passing. Example contract: `validateProfile(profile): string[]`, `validateJob(job): string[]`, `evaluateScreening(questions, answers): ScreeningResult[]`, `getFitIndicators(profile, job, answers): FitIndicator[]`.

## Task 2 — Supabase persistence and authorization

- [ ] Implement SQL with immutable job versions/application snapshots and functions accepting only owner-authored content. Derive applicant identity, submitted profile, screening results, and moderation actor inside the database.
- [ ] Implement the workspace API from the shared contract. GET exposes public listings without a session and adds only the signed-in user's authorized records. POST rejects unauthenticated requests, checks action ownership, and delegates atomic operations to restricted SQL functions.
- [ ] Add cookie-based server/browser clients and session-refresh proxy using current Supabase SSR guidance. Never use a service-role key in the browser or permit signup as admin.
- [ ] Write and run database tests if PostgreSQL is available; otherwise provide the runnable test script and explicitly document the unverified live database state. Run type checking for integration.

## Task 3 — public and applicant interface

- [ ] Build a warm cream/deep green editorial homepage, visible hospitality taxonomy, search entry point, job cards, and employer pages. No invented usage statistics, approval claims, or live testimonials.
- [ ] Search preserves query, city, department, salary, property type, accommodation, and meal filters in the URL. Only approved active company/listing combinations are public.
- [ ] Build the four-step profile with step saving, editable work history, fresher handling, role-specific skills, certifications, languages/proficiency, salary, notice, availability, relocation, and retryable errors.
- [ ] Build job-specific screening, review/submit, duplicate prevention, and application tracking with withdrawal. Submission never silently loses errors or changes snapshots.

## Task 4 — employer and admin interface

- [ ] Company onboarding shows draft/pending/rejected/approved state and moderation reasons; submitting does not imply approval.
- [ ] Vacancy form collects mandatory structured fields and five typed screening questions with explicit deal-breaker criteria. Support drafts, review submission, rejected resubmission, approved revisions, closing.
- [ ] Applicant view filters work history, experience, salary, joining, city, relocation, status, screening; sorts experience/salary/joining/newest. Display transparent fit comparisons, snapshot details, status updates, and contact links.
- [ ] Admin review allows approve/reject with reasons, suspension, and job removal with audit history. In connected mode routes and writes are gated by server-derived role; role switching is available only in the visibly labelled local demo.

## Task 5 — integration review and verification

- [ ] Review requirements against the actual routes and database behavior, then independently review code quality/security; fix material findings before handover.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`, inspecting full results.
- [ ] Start localhost, inspect desktop/mobile layouts and execute applicant submission, employer filters/status, and admin approval in the local demo. Check persistence after reload and duplicate errors.
- [ ] Record completed checks and any live Supabase checks still requiring project configuration in README and handover. Keep a local feature branch; no remote publishing or external messaging is needed.
