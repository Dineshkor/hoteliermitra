# Hospitality Hire: proposed MVP design

Date: 2026-10-02
Status: Proposed for user review. Implementation has not started.
Project directory: `D:\nextjs\hospitality-hire`
Working name: Hospitality Hire; replace when the owner chooses a brand.

## Purpose and success criteria

Build an India-only hiring website exclusively for hotels, restaurants, resorts, cafes, catering businesses, and similar hospitality properties. Employers need fewer irrelevant applications and faster decisions. Applicants need one reusable profile and a short application process on a basic smartphone.

The core product is structured information: hospitality roles, work history, salary, availability, relocation, and job-specific screening answers. Employer filtering and clear fit indicators are central features, rather than later additions.

The MVP succeeds when an approved employer can publish an approved vacancy, an applicant can apply with an existing profile, the employer can narrow that job's applicant list using meaningful filters, and the applicant can see the resulting status.

## Recommended approach and alternatives

1. Recommended: one Next.js application with applicant, employer, and admin areas, backed by Supabase Auth and PostgreSQL. This keeps the product coherent and avoids maintaining multiple services during the MVP.
2. UI-only prototype followed by the backend: useful for checking visual direction quickly, but it postpones testing the filtering and approval rules that make this product valuable. Use seeded development data for previews, while implementing the real backend alongside each flow.
3. Next.js plus a separate custom API: provides more infrastructure control, but adds deployment and authentication work without a clear MVP benefit. Defer unless a concrete requirement emerges.

## Assumptions to review

- English interface for the initial release; use plain language and keep text ready for later translation.
- India-only locations, INR amounts, and monthly salaries throughout both job listings and applicant profiles.
- Free job posting and applying initially; no payments, subscriptions, or promotions.
- One account has one primary role: applicant or employer. Admin access is provisioned privately and cannot be selected during signup.
- One employer account manages one company. A job can have a different property/location within that company; team accounts are deferred.
- Recommend phone OTP for applicant access, with optional email, because this audience primarily uses smartphones. Use email authentication for employers and admin. Phone OTP requires a configured SMS provider; authentication choice and provider setup must be confirmed before that dependent work.
- No mandatory CV, photograph, identity document, or cover letter. Structured profile data is the primary application.
- Contact happens through an explicit phone/email action initiated by the employer; no in-site messaging or automatic messages.
- Supabase project configuration will be supplied or established during backend setup. No live deployment is included without a deployment target.

## Main pages

| Audience | Page | Purpose |
| --- | --- | --- |
| Public | Home (`/`) | Explain hospitality hiring; distinct Find jobs and Hire staff entry points. |
| Public | Job search (`/jobs`) | Search by role, department, city, property type, salary, accommodation, and meals. |
| Public | Job details (`/jobs/[id]`) | Structured vacancy, employer/property details, benefits, and Apply action. |
| Public | Employer page (`/companies/[id]`) | Approved company information and its published vacancies. |
| Shared | Sign in and sign up | Select applicant or employer and use the agreed authentication method. |
| Applicant | Dashboard (`/applicant`) | Profile readiness, relevant job links, and recent application statuses. |
| Applicant | Profile (`/applicant/profile`) | Short, resumable steps to create and edit the reusable profile. |
| Applicant | Apply (`/jobs/[id]/apply`) | Review profile summary, answer screening questions, and submit once. |
| Applicant | Applications (`/applicant/applications`) | Track submitted, shortlisted, rejected, hired, and withdrawn applications. |
| Employer | Dashboard (`/employer`) | Company approval state, vacancies, and new applicant counts. |
| Employer | Company profile (`/employer/company`) | Create/edit company and property/contact information. |
| Employer | Vacancies (`/employer/jobs`) | Manage draft, pending, published, rejected, closed, and removed listings. |
| Employer | Job editor (`/employer/jobs/new`, `/employer/jobs/[id]/edit`) | Structured job form and screening-question builder. |
| Employer | Applicants (`/employer/jobs/[id]/applicants`) | Filter, sort, open candidates, and update application status. |
| Employer | Application detail | Submitted profile, work history, answers, fit indicators, and contact actions. |
| Admin | Review dashboard (`/admin`) | Queues for employer accounts and job listings requiring approval. |
| Admin | Employer, job, and user management | Approve/reject with reasons; suspend users and remove listings. |

## User flows

### Applicant

Browse jobs without signing in -> open a vacancy -> sign up/sign in when applying -> finish missing required profile details -> answer that job's questions -> review and submit -> view application status.

Returning applicants reuse their profile, answer only the new job's screening questions, and submit. A unique constraint prevents duplicate applications to the same job. Profile edits affect future applications; submitted applications retain their original snapshot. Applicants may withdraw an application.

### Employer

Sign up -> create company profile -> submit company for admin approval -> prepare a vacancy and screening questions -> submit vacancy for review -> approved vacancy becomes public -> review/filter applicants -> shortlist or reject -> contact selected applicants -> optionally mark hired -> close vacancy.

Pending employers can prepare drafts, but cannot publish jobs. Rejected submissions display the admin's reason and can be corrected and resubmitted. Editing a published job's hiring requirements creates a pending revision; the last approved version remains public until the revision is approved. Submitted applications remain associated with the version used when applying.

### Admin

Sign in with privately assigned access -> review company details -> approve or reject with a reason -> review job details -> approve or reject -> suspend fake accounts or remove problematic jobs when necessary.

Suspending an employer hides its listings and blocks new applications immediately. Removal and suspension preserve moderation history. Employers and applicants can see the relevant closed/removed status for their existing applications.

## Hospitality data and forms

### Taxonomy

Departments: Kitchen, Food & Beverage Service, Front Office, Housekeeping, Maintenance, and Management. Each department has a curated role list, including commis, chef de partie, sous chef, cook, kitchen helper, steward, waiter, bartender, receptionist, housekeeping attendant, supervisor, and manager.

Property types: hotel, restaurant, resort, cafe, catering business, serviced accommodation, and other hospitality property. Employers must describe the last category for moderation. Roles and property types are shared between jobs, profiles, work history, and filters.

### Applicant profile

Use four short steps with progress, step-level saving, appropriate mobile keyboards, and visible required/optional labels:

1. Basics: name, contact phone, current city, department, primary role, total experience (including fresher).
2. Work: repeated entries for employer, property type, role, start/end month or current employment, and optional reason for leaving. Experienced applicants provide at least their most recent workplace; freshers skip this step.
3. Skills: role-relevant selectable skills, languages with basic/working/fluent proficiency, and optional certifications. Require at least one spoken language; certifications are required only when a job explicitly asks about them.
4. Preferences: current monthly salary or not currently employed/prefer not to disclose, expected monthly salary, notice period, earliest joining date or available now, and willingness to relocate. Preferred cities are optional and shown when relocation is selected.

Required information supports filtering. Reasons for leaving, certification uploads, a biography, and a CV do not block applications. Validate salary and experience as nonnegative, date ranges as consistent, and role/department combinations against the shared taxonomy. Save completed steps without discarding earlier entries if connectivity fails.

### Vacancy

Required: role/department, property type, city/locality, employment type, minimum experience (zero allowed), monthly salary minimum and maximum, shift type, accommodation yes/no, meals yes/no, number of openings, responsibilities, and employer/property identity.

Optional: preferred upper experience range, relevant skills/languages, joining deadline, and a small set of screening questions. Clearly distinguish required qualifications from preferences. Salary minimum cannot exceed maximum; openings must be a positive integer.

Screening questions support yes/no, single choice, numeric, and short text. Employers can mark questions required. Deal-breakers need an explicit expected answer or numeric threshold; short text is reviewed manually and cannot be an automatic deal-breaker. Keep the initial builder to five questions per job. Deal-breaker failures are flagged for review, rather than silently rejecting an applicant.

## Employer filtering and fit indicators

Filter within an employer's own job by application status, experience range, previous employer name, previous property type, expected salary, joining availability, current city, relocation willingness, and deal-breaker results. Sort by newest application, experience, expected salary, or earliest joining. Use server-side filtering and pagination so the interface stays usable as applications grow.

Use cards on phones and a compact table/list on larger screens. Display key fields before opening a profile: role, experience, current city, recent workplace, salary expectation, joining availability, screening result, and application status.

Fit indicators are transparent comparisons, not AI or an unexplained ranking. Examples: Meets minimum experience, Salary within range, Available by joining date, Willing to relocate, and Screening requirement not met. Do not infer a fit when relevant data is missing. Location fit is based on current city or stated willingness/preference to relocate, and is labelled as self-reported.

Applicants can still submit when a preference does not match; the employer sees the mismatch. Missing required application fields and screening answers block submission with clear inline errors. The employer makes the final decision.

## Architecture and data boundaries

Use Next.js App Router, TypeScript, and a lightweight responsive UI. Public job pages render on the server; client components handle interactive filters, profile steps, and form controls. Server actions/route handlers validate and authorize mutations.

Supabase provides authentication and PostgreSQL. Use separate browser/server Supabase clients with cookie-based sessions, following the current SSR guidance. Access rules are enforced in PostgreSQL Row Level Security as well as server authorization; hiding a UI control is insufficient.

Main tables:

- `profiles`: authenticated user identity and privately controlled primary role/account state.
- `applicant_profiles`, `work_experiences`: reusable applicant details and structured work history.
- `companies`: employer ownership, business details, contact information, and moderation state.
- `jobs`, `job_versions`: listing identity, approved/pending versions, structured requirements, and lifecycle state.
- `screening_questions`: version-specific question definitions and deterministic criteria.
- `applications`: applicant/job/version relation, unique submission, immutable profile snapshot, indexed filtering fields, and current status.
- `application_answers`: submitted answers and server-computed deal-breaker results.
- `application_events`, `moderation_events`: status changes and moderation actions with actor/time/reason.

Keep immutable application data under database control. Application submission uses one transaction to verify job/company visibility, prevent duplicates, validate answers, capture the profile snapshot, and insert the application and answers. The caller cannot choose a different applicant, forge a screening result, or supply a fabricated profile snapshot.

Applicants read/edit their own profiles and read their own applications. Employers read only submissions to their own jobs, including the contact details applicants shared when applying. They cannot browse a global candidate directory. Public access sees only approved company information and published approved vacancies, never private contact/salary/profile data. Admin privileges are assigned out of band and cannot be elevated through client-controlled metadata.

Use restrictive table/column permissions or narrow database functions for status changes and moderation. Protect immutable snapshots, ownership, account roles, review outcomes, and screening criteria from unauthorized changes. Suspending an account must be enforced by access/submission rules, rather than relying on a browser session being logged out.

## Interface direction

Calm, trustworthy, hospitality-specific presentation: warm off-white surfaces, deep green primary actions, readable dark text, modest accents, and restrained hospitality imagery where it helps. Avoid decorative elements that slow basic phones.

Use short labels, obvious next actions, large touch targets, readable type, keyboard-accessible controls, and visible focus states. Forms are single-column on phones. Search/filter state is preserved in the URL where appropriate. Show useful empty states, loading feedback, retry actions, and the exact fields that need correction. Avoid mandatory long free-text answers.

## Build sequence

1. Foundation: new isolated project, shared taxonomy/types, responsive shell, public job search/details, seeded preview data explicitly marked as development data.
2. Authentication and backend: Supabase migrations, access policies, role-aware routing, company onboarding, admin employer review.
3. Applicant profile: resumable steps, work history, skills/languages, salary/availability, required-field validation.
4. Employer vacancies: draft editor, screening builder, review/resubmission, approved publication and revisions.
5. Applications and review: transactional submission, snapshots, screening evaluation, employer filters/status/contact actions, applicant tracking.
6. Verification and handover: real database authorization checks, core workflow checks, responsive browser review, deployment/setup instructions.

Each step should run locally and be reviewed against the approved design before moving to dependent work. Seeded preview data must never be presented as live employers or applicants.

## Verification and acceptance

- Complete the end-to-end journey with applicant, employer, and admin accounts.
- Confirm unapproved/suspended employers and pending/removed jobs cannot appear publicly or accept applications.
- Confirm applicants cannot access another applicant's data, employers cannot access another employer's applications, and users cannot assign themselves admin privileges.
- Confirm profile edits do not change historical application snapshots, forged screening results are rejected, and concurrent duplicate applications produce a clear error.
- Confirm filters return the expected candidates for salary, experience, property history, location, availability, and deal-breakers, including missing-field edge cases.
- Confirm status updates are visible to the applicant and restricted to valid actors/transitions.
- Check production build, type checking, linting, and focused tests for authorization, submission, and filtering logic.
- Inspect narrow mobile layouts and larger screens; check form labels, focus, error recovery, touch targets, and heavy asset/bundle use.

## Out of scope

No chat system, AI matching, mobile app, complex analytics, payments, bulk messaging, global resume search, employer team accounts, or general-industry job listings. The first release focuses on structured vacancies, reusable profiles, screening questions, approvals, and practical applicant filtering.

## Reference documentation checked

- Next.js App Router: https://nextjs.org/docs/app
- Supabase Next.js SSR: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase phone authentication: https://supabase.com/docs/guides/auth/phone-login
