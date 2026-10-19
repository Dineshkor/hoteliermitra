# Hospitality Hire

A hospitality-only hiring MVP for India, built with Next.js 16, React 19, TypeScript, and Supabase. The working brand is replaceable. Salaries use INR per month.

## Run locally

Use Node.js 22.14 or newer and npm. From this directory:

```powershell
npm ci
npm run dev
```

Open **http://localhost:3001**. Without Supabase environment variables, the app opens an explicitly labelled local demo with fictional companies, vacancies, and people. The top bar switches applicant, employer, and admin previews. Changes persist in this browser's local storage; **Reset demo** restores the fixtures. No real accounts, OTPs, applications, or messages are sent in demo mode.

For a production build locally:

```powershell
npm run build
npm start
```

## What is implemented

- Public hospitality job search with URL filters, structured vacancy details, benefits, and employer pages.
- Four-step reusable applicant profiles: role/department, work history, skills/certifications, languages, monthly salary, notice, availability, and relocation. Freshers can skip work history. Draft steps save independently.
- Job-specific yes/no, choice, number, and short-text screening, with explicit deal-breaker conditions. Applications capture immutable profile, job, and answer snapshots; duplicate applications are blocked.
- Employer company onboarding, vacancy drafts and moderation, pending revisions, closing, twelve-candidate pagination, filters/sorting, transparent fit comparisons, shortlist/reject/hire, and explicit phone/email contact actions.
- Applicant status tracking, decision history, withdrawal, and visibility of closed or removed vacancies already applied to.
- Saved jobs and saved searches with an explicit daily-alerts opt-in. The saved page keeps a shortlist, shows live match counts per search, and keeps closed or removed vacancies visible with one-tap removal.
- Admin company/vacancy approval, rejection/removal reasons, suspension, account management, and moderation history. Live admin access is assigned privately.
- Supabase cookie authentication, database-enforced role/ownership rules, RLS-protected reads, and checked transactional mutations. Employers see snapshots only for applicants to their own vacancies.

Fit indicators compare stated requirements to submitted data. Screening flags help employers review candidates; they do not automatically reject applications. Saved-search alerts store the delivery-ready match logic (`buildDigest`) and alert preferences now, but digest email sending, its scheduler, and unsubscribe handling are deliberately deferred until deployment. There is no chat, AI matching, payment system, native app, or complex analytics.

## Connect Supabase

1. Create a fresh Supabase project and apply the SQL in `supabase/migrations/` in filename order.
2. Copy `.env.example` to `.env.local`, then set the project URL and **public publishable key**. A service-role key is not used.
3. Set the local Auth Site URL to `http://localhost:3001` and configure email OTP templates and delivery. Applicants, employers, and admins all sign in with email OTP; no SMS provider is required.
4. Sign up an account and privately assign its admin role using the SQL in the setup guide.
5. Restart Next.js. Configured mode uses the real database and never falls back to fictional data on an error.

See [the complete Supabase setup guide](supabase/README.md) for Auth redirects, email templates, admin provisioning, API contracts, and database tests. For deployment, set the same two environment variables on a Next.js-compatible host and update Supabase Auth URLs to that origin. No deployment has been performed.

## Main routes

| Audience  | Routes                                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public    | `/`, `/jobs`, `/jobs/[id]`, `/companies/[id]`, `/login`                                                                                                                                  |
| Applicant | `/applicant`, `/applicant/profile`, `/jobs/[id]/apply`, `/applicant/applications`, `/applicant/saved`                                                         |
| Employer  | `/employer`, `/employer/company`, `/employer/jobs`, `/employer/jobs/new`, `/employer/jobs/[id]/edit`, `/employer/jobs/[id]/applicants`, `/employer/jobs/[id]/applicants/[applicationId]` |
| Admin     | `/admin`, `/admin/users`                                                                                                                                                                 |

## Verify

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

With an unconfigured local server running on port 3001, run `npm run test:smoke` for HTTP route, 404, and explicit unconfigured-API checks. Set `SMOKE_ORIGIN` to test a different local port; this script expects demo mode.

The test suite includes domain rules, demo workflow transitions, request validation, React interaction journeys, and the real SQL migrations under embedded PostgreSQL (PGlite). Database checks cover identity, ownership, privacy, screening, immutable revisions/snapshots, moderation, counts, filtering/pagination, and suspension. The React tests exercise forms and navigation with mocked Next.js routing; they do not replace a real browser layout check.

Verified on 2026-10-19: **68 tests passed**, including **210 SQL assertions**; TypeScript, ESLint, production build, and all ten HTTP smoke checks passed (including the new `/applicant/saved` route). The saved jobs and alerts design and implementation checklist live in `docs/superpowers/`.

**Verification limits:** Hosted Supabase Auth, email delivery, cookie rotation, concurrent sessions, and deployment require project configuration and remain unverified. Desktop/mobile browser visual inspection remains pending because no browser surface was connected in the build environment. Responsive CSS and local HTTP/React interaction checks are implemented.

## Code map

- `src/components/pages/`: public, applicant, employer, candidate, admin, and login interfaces.
- `src/components/workspace-provider.tsx`: demo persistence or authenticated API adapter.
- `src/lib/domain.ts`: profile/job readiness, screening, fit comparisons, filters, and status transitions.
- `src/lib/demo.ts` and `demo-actions.ts`: fictional fixtures and local workflow.
- `src/lib/supabase/`, `src/proxy.ts`, `src/app/api/`: Supabase sessions and request boundaries.
- `supabase/migrations/` and `supabase/tests/`: schema, protected functions, RLS, and SQL verification.
- `docs/superpowers/`: approved design and implementation checklist.

DM Sans fonts are bundled locally under the [SIL Open Font License](public/DM-Sans-LICENSE.txt). The restaurant image is from [Unsplash](https://images.unsplash.com/photo-1414235077428-338989a2e8c0); it is decorative and does not represent any demo employer. Lucide supplies interface icons.
