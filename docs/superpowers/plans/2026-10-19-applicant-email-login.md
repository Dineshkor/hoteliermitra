# Email-Only Applicant Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace applicant phone OTP with email OTP so every role signs in through the existing email flow, removing the SMS dependency entirely.

**Architecture:** The login screen already contains a complete email OTP branch used by employer/admin sign-in. The phone branch is deleted and every role routes through the email branch; role metadata and admin creation rules are preserved. No server, database, or auth-callback changes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Auth OTP, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-19-applicant-email-login-design.md`

## Global Constraints

- All roles (applicant, employer, admin) use `signInWithOtp({ email, options })` and `verifyOtp({ email, token, type: "email" })`. No `phone` call, `+91` normalization, or `type: "sms"` may remain.
- Request options: `shouldCreateUser: true` for applicant/employer, `false` for admin; `data: { role }` for non-admin, `undefined` for admin; `emailRedirectTo: ${window.location.origin}/auth/confirm?next=${encodeURIComponent(destination)}`.
- Destinations unchanged: applicant → `params.get("next")` when it starts with `/jobs/`, otherwise `/applicant`; employer → `/employer`; admin → `/admin`.
- Copy: field label "Email address"; placeholder `you@yourproperty.com` for employer, `you@example.com` otherwise; challenge copy "Enter the code sent to <contact>."; change control "Use a different email"; request success "Check your email for the verification code or sign-in link."; verify success "You're signed in."
- Pending-state behavior unchanged: while `task.busy`, role buttons, contact input, code input, submit, and change-contact are disabled.
- No SQL or migration changes.

## Review Focus

- Applicant sign-up must create the account with `role: applicant`; employer sign-up must keep `role: employer`; admin sign-in must never create a user (`shouldCreateUser: false`).
- The sign-in link destination must carry the encoded `next` (apply-page return) — a wrong or unencoded redirect breaks post-login landing.
- Verification must use `type: "email"`; any leftover `"sms"` silently fails to verify codes.
- No phone/SMS copy or branch may survive (dead code that misleads future changes).
- Pending/in-flight requests must keep all controls disabled so a user cannot change the challenged contact mid-flight.

---

### Task 1: Email-only login flow with rewritten tests

**Files:**
- Modify: `src/components/pages/login.tsx` (lines ~32-81 logic, ~174-235 challenge/form markup)
- Test: `src/components/login.test.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/client`; `useWorkspace()` (`reload`); existing `Field`, `Button`, `Notice`, `useTask`.
- Produces: nothing new — same `Login` component, same destinations and callbacks; `signInWithOtp`/`verifyOtp` are called with email payloads only.

- [ ] **Step 1: Rewrite the test for the email flow**

First, add a settable search string to the hoisted mocks in `src/components/login.test.tsx` so a test can open the admin role, and reset it in `beforeEach`:

```tsx
const auth = vi.hoisted(() => ({
  requestCode: vi.fn(),
  verifyCode: vi.fn(),
  reload: vi.fn(),
  switchRole: vi.fn(),
  push: vi.fn(),
  search: "",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: auth.push }),
  useSearchParams: () => new URLSearchParams(auth.search),
}));
```

(`beforeEach` already runs `vi.clearAllMocks(); auth.reload.mockResolvedValue(undefined);` — add `auth.search = "";`.)

Then replace the single `describe("OTP challenge controls")` body with three tests:

```tsx
describe("OTP challenge controls", () => {
  it("keeps the original email challenge during pending request and verification", async () => {
    const requested = deferred<{ error: null }>();
    const verified = deferred<{ error: null }>();
    auth.requestCode.mockReturnValue(requested.promise);
    auth.verifyCode.mockReturnValue(verified.promise);
    render(<Login />);
    const user = userEvent.setup();
    const email = screen.getByLabelText(/Email address/) as HTMLInputElement;

    await user.type(email, "applicant@example.com");
    await user.click(
      screen.getByRole("button", { name: /Send verification code/ }),
    );
    const applicant = screen.getByRole("button", { name: /looking for a job/ });
    const employer = screen.getByRole("button", { name: /hiring staff/ });
    expect((applicant as HTMLButtonElement).disabled).toBe(true);
    expect((employer as HTMLButtonElement).disabled).toBe(true);
    expect(email.disabled).toBe(true);
    await user.click(employer);
    await user.type(email, "1");
    expect(email.value).toBe("applicant@example.com");
    expect(screen.queryByLabelText(/Mobile number/)).toBeNull();
    expect(auth.requestCode).toHaveBeenCalledExactlyOnceWith({
      email: "applicant@example.com",
      options: {
        shouldCreateUser: true,
        data: { role: "applicant" },
        emailRedirectTo: expect.stringContaining(
          "/auth/confirm?next=%2Fapplicant",
        ),
      },
    });

    await act(async () => {
      requested.resolve({ error: null });
      await requested.promise;
    });
    const code = (await screen.findByLabelText(
      "Verification code",
    )) as HTMLInputElement;
    expect(
      screen.getByText("Enter the code sent to applicant@example.com."),
    ).toBeDefined();
    await user.type(code, "123456");
    await user.click(screen.getByRole("button", { name: /Verify & continue/ }));
    const changeContact = screen.getByRole("button", {
      name: /Use a different email/,
    });
    expect(code.disabled).toBe(true);
    expect((changeContact as HTMLButtonElement).disabled).toBe(true);
    await user.click(changeContact);
    await user.type(code, "7");
    expect(code.value).toBe("123456");
    expect(screen.queryByLabelText(/Email address/)).toBeNull();
    expect(auth.verifyCode).toHaveBeenCalledExactlyOnceWith({
      email: "applicant@example.com",
      token: "123456",
      type: "email",
    });

    await act(async () => {
      verified.resolve({ error: null });
      await verified.promise;
    });
    await waitFor(() =>
      expect(auth.push).toHaveBeenCalledExactlyOnceWith("/applicant"),
    );
    expect(auth.reload).toHaveBeenCalledTimes(1);
  });
  it("requests employer sign-up with the employer role", async () => {
    auth.requestCode.mockResolvedValue({ error: null });
    render(<Login />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /hiring staff/ }));
    await user.type(
      screen.getByLabelText(/Email address/),
      "chef@hotel.example",
    );
    await user.click(
      screen.getByRole("button", { name: /Send verification code/ }),
    );
    expect(auth.requestCode).toHaveBeenCalledExactlyOnceWith({
      email: "chef@hotel.example",
      options: {
        shouldCreateUser: true,
        data: { role: "employer" },
        emailRedirectTo: expect.stringContaining(
          "/auth/confirm?next=%2Femployer",
        ),
      },
    });
  });
  it("signs in admins without creating an account", async () => {
    auth.search = "role=admin";
    auth.requestCode.mockResolvedValue({ error: null });
    render(<Login />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Email address/), "boss@example.com");
    await user.click(
      screen.getByRole("button", { name: /Send verification code/ }),
    );
    expect(auth.requestCode).toHaveBeenCalledExactlyOnceWith({
      email: "boss@example.com",
      options: {
        shouldCreateUser: false,
        data: undefined,
        emailRedirectTo: expect.stringContaining("/auth/confirm?next=%2Fadmin"),
      },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/login.test.tsx`
Expected: FAIL — the current screen has no "Email address" label for applicants (renders "Mobile number").

- [ ] **Step 3: Implement the email-only login in `src/components/pages/login.tsx`**

Replace the phone/email branches in `requestCode` and `verify`:

```tsx
async function requestCode() {
  await task.run(
    async () => {
      const supabase = createClient();
      const result = await supabase.auth.signInWithOtp({
        email: contact,
        options: {
          shouldCreateUser: role !== "admin",
          data: role === "admin" ? undefined : { role },
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(destination)}`,
        },
      });
      if (result.error) throw new Error(result.error.message);
      setSent(true);
    },
    "Check your email for the verification code or sign-in link.",
  );
}
async function verify() {
  await task.run(async () => {
    const supabase = createClient();
    const result = await supabase.auth.verifyOtp({
      email: contact,
      token: code,
      type: "email",
    });
    if (result.error) throw new Error(result.error.message);
    await reload();
    router.push(destination);
  }, "You’re signed in.");
}
```

In the markup: the contact `Field` becomes `label="Email address"`, `type="email"`, `autoComplete="email"`, no phone hint, `placeholder={role === "employer" ? "you@yourproperty.com" : "you@example.com"}`; the change-contact button text becomes `Use a different email` (no role ternary).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/login.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite to catch collateral breakage**

Run: `npx vitest run`
Expected: PASS, 68 tests across 9 files.

- [ ] **Step 6: Commit**

```bash
git add src/components/pages/login.tsx src/components/login.test.tsx
git commit -m "feat: sign in applicants with email"
```

### Task 2: Documentation and full verification

**Files:**
- Modify: `README.md` (run-locally note, Supabase step 3, guide reference, verification record, limits)
- Modify: `supabase/README.md` (auth setup steps 4-5, hosted-check note)

**Interfaces:**
- Consumes: nothing from Task 1 at runtime; documents the behavior it shipped.
- Produces: docs consistent with "email OTP for all roles; no SMS".

- [ ] **Step 1: Update the docs**

`README.md`:
- Supabase step 3 → "Set the local Auth Site URL to `http://localhost:3001` and configure email OTP templates and delivery. Applicants, employers, and admins all sign in with email OTP; no SMS provider is required."
- Guide-reference sentence → drop "SMS" from the list.
- Verification-limits sentence → "Hosted Supabase Auth, email delivery, cookie rotation, concurrent sessions, and deployment require project configuration and remain unverified."
- After the full run below, update the verification record to the actual counts (expect 68 tests, 210 SQL assertions).

`supabase/README.md`:
- Step 4 → state that all roles use email OTP and the login screen needs `{{ .Token }}` in the template (keep existing template guidance).
- Step 5 → replace the phone/SMS paragraph with: "Phone authentication is not used by this app. Applicants, employers, and admins sign in with email OTP; the applicant profile's contact phone is stored only as data for employers. Configure SMTP for production email delivery; the built-in email provider has development limits. Configure Auth rate limits and CAPTCHA to suit production traffic."
- Hosted-check note → "A hosted end-to-end Auth/email check still requires project credentials and configured email delivery; the embedded suite does not simulate Auth HTTP services, cookie rotation, network transport, or concurrent sessions."
- The applicant-profile paragraph mentioning phone/email contact actions needs no change.

- [ ] **Step 2: Full verification**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all pass; note the exact test count for the README record.

- [ ] **Step 3: Manual live check (owner)**

With `npm run dev` running and `.env.local` configured: open `/login`, stay on the applicant role, request a code for a real email, enter the code from the email, and confirm the redirect to `/applicant` succeeds. If the project owner is unavailable, record the check as pending in the README verification record rather than claiming it passed.

- [ ] **Step 4: Commit**

```bash
git add README.md supabase/README.md
git commit -m "docs: make email the only sign-in method"
```
