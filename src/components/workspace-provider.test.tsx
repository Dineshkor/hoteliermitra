// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createDemo, emptyWorkspace } from "@/lib/demo";
import { useWorkspace, WorkspaceProvider } from "./workspace-provider";
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-public-key";
});
vi.mock("next/navigation", () => ({ usePathname: () => "/applicant/profile" }));
function Controls() {
  const { state, reload, mutate } = useWorkspace();
  return (
    <>
      <p>{state.profile?.name}</p>
      <p>{state.role || "anonymous"}</p>
      <button onClick={() => void reload()}>Refresh</button>
      <button
        onClick={() =>
          void mutate({
            action: "profile.save",
            payload: { ...state.profile!, name: "Updated applicant" },
          })
        }
      >
        Save
      </button>
    </>
  );
}
beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("does not replace a successful save with an older in-flight workspace read", async () => {
  const old = createDemo();
  const fresh = structuredClone(old);
  fresh.profile!.name = "Updated applicant";
  let release!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  vi.mocked(fetch).mockImplementation(async (_url, init) =>
    init?.method === "POST" ? Response.json({ workspace: fresh }) : pending,
  );
  render(
    <WorkspaceProvider initialWorkspace={old} initialLoaded>
      <Controls />
    </WorkspaceProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Refresh" }));
  await user.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Updated applicant");
  await act(async () => {
    release(Response.json({ workspace: old }));
    await pending;
  });
  expect(screen.queryByText("Aarav Sharma")).toBeNull();
  expect(screen.getByText("Updated applicant")).toBeDefined();
});
it("refreshes the signed-out session after an in-flight save drains", async () => {
  const state = createDemo();
  let release!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  vi.mocked(fetch).mockImplementation(async (_url, init) =>
    init?.method === "POST"
      ? pending
      : Response.json({ workspace: emptyWorkspace }),
  );
  render(
    <WorkspaceProvider initialWorkspace={state} initialLoaded>
      <Controls />
    </WorkspaceProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Save" }));
  await user.click(screen.getByRole("button", { name: "Refresh" }));
  await act(async () => {
    release(Response.json({ workspace: state }));
    await pending;
  });
  await screen.findByText("anonymous");
  expect(screen.queryByText("Aarav Sharma")).toBeNull();
});
