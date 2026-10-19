// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "./pages/login";

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
vi.mock("./workspace-provider", () => ({
  useWorkspace: () => ({
    demo: false,
    reload: auth.reload,
    switchRole: auth.switchRole,
  }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: auth.requestCode,
      verifyOtp: auth.verifyCode,
    },
  }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.search = "";
  auth.reload.mockResolvedValue(undefined);
});
afterEach(cleanup);

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
