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
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: auth.push }),
  useSearchParams: () => new URLSearchParams(),
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
  auth.reload.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("OTP challenge controls", () => {
  it("keeps the original phone challenge during pending request and verification", async () => {
    const requested = deferred<{ error: null }>();
    const verified = deferred<{ error: null }>();
    auth.requestCode.mockReturnValue(requested.promise);
    auth.verifyCode.mockReturnValue(verified.promise);
    render(<Login />);
    const user = userEvent.setup();
    const phone = screen.getByLabelText(/Mobile number/) as HTMLInputElement;

    await user.type(phone, "9876543210");
    await user.click(
      screen.getByRole("button", { name: /Send verification code/ }),
    );
    const applicant = screen.getByRole("button", { name: /looking for a job/ });
    const employer = screen.getByRole("button", { name: /hiring staff/ });
    expect((applicant as HTMLButtonElement).disabled).toBe(true);
    expect((employer as HTMLButtonElement).disabled).toBe(true);
    expect(phone.disabled).toBe(true);
    await user.click(employer);
    await user.type(phone, "1");
    expect(phone.value).toBe("9876543210");
    expect(screen.queryByLabelText(/Email address/)).toBeNull();
    expect(auth.requestCode).toHaveBeenCalledExactlyOnceWith({
      phone: "+919876543210",
      options: { shouldCreateUser: true, data: { role: "applicant" } },
    });

    await act(async () => {
      requested.resolve({ error: null });
      await requested.promise;
    });
    const code = (await screen.findByLabelText(
      "Verification code",
    )) as HTMLInputElement;
    expect(
      screen.getByText("Enter the code sent to 9876543210."),
    ).toBeDefined();
    await user.type(code, "123456");
    await user.click(screen.getByRole("button", { name: /Verify & continue/ }));
    const changeContact = screen.getByRole("button", {
      name: /Use a different phone number/,
    });
    expect(code.disabled).toBe(true);
    expect((changeContact as HTMLButtonElement).disabled).toBe(true);
    await user.click(changeContact);
    await user.type(code, "7");
    expect(code.value).toBe("123456");
    expect(screen.queryByLabelText(/Mobile number/)).toBeNull();
    expect(auth.verifyCode).toHaveBeenCalledExactlyOnceWith({
      phone: "+919876543210",
      token: "123456",
      type: "sms",
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
});
