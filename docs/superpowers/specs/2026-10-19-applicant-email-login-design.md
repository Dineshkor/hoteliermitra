# Email-only applicant sign-in

Date: 2026-10-19
Status: Approved

## Context

Applicant sign-in currently uses phone OTP (`signInWithOtp({ phone })` and `verifyOtp({ type: "sms" })`) while employers and admins use email OTP. The project owner cannot fund SMS delivery, and the Supabase project is fresh with no phone-authenticated users. Email OTP is already configured and working for employer/admin sign-in.

## Decision

Replace phone sign-in with email sign-in for applicants. All roles use one email OTP flow. The phone branch, `+91` normalization, and SMS verification are removed from the login screen. Keeping a dormant phone path is out of scope (YAGNI); git history retains it if SMS is added later.

## Behavior

- `/login` still defaults to the applicant role. Role buttons and destinations are unchanged (`/applicant`, `/employer`, `/admin`; `next` may still target a job apply page).
- Every role sees a single "Email address" field and the submit button "Send verification code".
- Request: `supabase.auth.signInWithOtp({ email, options })` with `shouldCreateUser: true` for applicants and employers, `false` for admins; `data: { role }` for non-admin sign-ups; `emailRedirectTo` keeps pointing to `/auth/confirm?next=<destination>`.
- Verification: `supabase.auth.verifyOtp({ email, token, type: "email" })`.
- Pending states remain disabled while requests are in flight. The change-contact control reads "Use a different email" and the challenge copy reads "Enter the code sent to <email>."
- Success messages: "Check your email for the verification code or sign-in link." and "You're signed in."

## Changes

- `src/components/pages/login.tsx`: remove phone-specific branching, literals, formatting, and the `type: "sms"` verification; collapse request/verify to the email path for all roles.
- `src/components/login.test.tsx`: replace the phone challenge test with an equivalent email challenge test covering: applicant request payload (`email`, `shouldCreateUser: true`, `data: { role: "applicant" }`, `emailRedirectTo`), role/input disabling while pending, "Use a different email", verify payload (`email`, `token`, `type: "email"`), reload and redirect to `/applicant`.
- `README.md`: remove the requirement for phone auth/SMS; state that applicants, employers, and admins sign in with email OTP.
- `supabase/README.md`: update Auth setup steps accordingly; note that the profile "Contact phone" field remains as employer contact data and is not used for authentication.

## Unchanged

Auth callback route and email template requirements (`{{ .Token }}`), accounts trigger and role metadata, employer/admin flows, profile contact phone, database schema and RLS. No migrations.

## Security

Authentication continues to be handled by Supabase OTP; the app never stores credentials. Removing SMS removes one delivery channel and its cost. If phone-authenticated users existed, they would need manual account handling, but the target project has none.

## Verification

1. `npx vitest run src/components/login.test.tsx` passes with the rewritten email test.
2. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass.
3. Manual check against the live Supabase project: request an applicant code with a real email, verify the code, land on `/applicant`, and confirm the account appears with role `applicant`.

## Acceptance criteria

- No phone/SMS code or copy remains in the login screen.
- Applicant, employer, and admin sign-in all use email OTP.
- Pending-state behavior and redirects are preserved.
- The full verification suite passes and the live email flow is demonstrated.
