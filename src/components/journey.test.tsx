// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  useState,
  useEffect,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";
import { WorkspaceProvider } from "./workspace-provider";
import { RouteView } from "./route-view";
import { createDemo } from "@/lib/demo";
import { SearchBar } from "./pages/public";
import type { Workspace } from "@/lib/types";
const nav = vi.hoisted(() => ({ url: "/", push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.url.split("?")[0],
  useSearchParams: () => new URLSearchParams(nav.url.split("?")[1] || ""),
  notFound: () => {
    throw new Error("Not found");
  },
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => (
    <a
      href={href}
      {...props}
      onClick={(e) => {
        e.preventDefault();
        nav.push(String(href));
      }}
    >
      {children}
    </a>
  ),
}));
function Harness({ state }: { state: Workspace }) {
  const [url, setUrl] = useState(nav.url);
  useEffect(() => {
    nav.push.mockImplementation((href: string) => {
      nav.url = href;
      setUrl(href);
    });
    nav.replace.mockImplementation((href: string) => {
      nav.url = href;
      setUrl(href);
    });
  }, []);
  return (
    <WorkspaceProvider initialWorkspace={state} initialLoaded>
      <RouteView path={url.split("?")[0].split("/").filter(Boolean)} />
    </WorkspaceProvider>
  );
}
beforeEach(() => {
  localStorage.clear();
  nav.push.mockReset();
  nav.replace.mockReset();
  window.scrollTo = vi.fn();
});
afterEach(cleanup);
describe("hospitality hiring interactions", () => {
  it("resets edited search inputs when URL filters are cleared", async () => {
    nav.url = "/jobs?q=Chef&city=Mumbai";
    const view = render(<SearchBar />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Job title or keyword"));
    await user.type(screen.getByLabelText("Job title or keyword"), "Sous Chef");
    await user.clear(screen.getByLabelText("City"));
    await user.type(screen.getByLabelText("City"), "Goa");
    nav.url = "/jobs";
    view.rerender(<SearchBar />);
    expect(
      (screen.getByLabelText("Job title or keyword") as HTMLInputElement).value,
    ).toBe("");
    expect((screen.getByLabelText("City") as HTMLInputElement).value).toBe("");
  });
  it("announces unmet fit indicators in text", () => {
    nav.url = "/jobs/commis-chef/apply";
    const state = createDemo();
    state.profile!.expectedSalary = 99999;
    render(<Harness state={state} />);
    expect(screen.getByText("Salary within range").textContent).toContain(
      "Not met",
    );
  });
  it("applies with screening, tracks the snapshot and withdraws", async () => {
    nav.url = "/jobs/commis-chef/apply";
    render(<Harness state={createDemo()} />);
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByLabelText(/Are you comfortable working rotational shifts/),
      "Yes",
    );
    await user.type(
      screen.getByLabelText(/How many years have you worked/),
      "2",
    );
    await user.click(
      screen.getByRole("button", { name: /Submit application/ }),
    );
    await screen.findByRole("heading", { name: "Your next step starts here." });
    await user.click(
      screen.getByRole("button", { name: "View submitted details" }),
    );
    expect(screen.getByText("Aarav Sharma")).toBeDefined();
    await user.click(
      screen.getByRole("button", { name: "Withdraw application" }),
    );
    await screen.findByRole("status");
    expect(screen.getAllByText("Withdrawn").length).toBeGreaterThan(0);
    const stored = JSON.parse(
      localStorage.getItem("hospitality-hire-demo-v2") || "{}",
    );
    expect(stored.applications.at(-1).status).toBe("withdrawn");
  });
  it("saves all profile steps and multiple preferred cities", async () => {
    nav.url = "/applicant/profile";
    render(<Harness state={createDemo()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Save & continue/ }));
    await screen.findByRole("heading", {
      name: "Your hospitality experience.",
    });
    await user.click(screen.getByRole("button", { name: /Save & continue/ }));
    await screen.findByRole("heading", {
      name: "The skills behind your service.",
    });
    await user.click(screen.getByRole("button", { name: /Save & continue/ }));
    await screen.findByRole("heading", { name: "What works for you?" });
    const cities = screen.getByLabelText(/Preferred cities/);
    await user.clear(cities);
    await user.type(cities, "Goa, Pune");
    await user.click(screen.getByRole("button", { name: "Save my profile" }));
    await screen.findByText(
      "Your profile is ready. You can use it for every application.",
    );
    expect(
      JSON.parse(localStorage.getItem("hospitality-hire-demo-v2") || "{}")
        .profile.preferredCities,
    ).toEqual(["Goa", "Pune"]);
  });
  it("filters salary expectations and shortlists the selected candidate", async () => {
    nav.url = "/employer/jobs/commis-chef/applicants";
    const state = createDemo();
    state.role = "employer";
    state.userId = "demo-employer";
    render(<Harness state={state} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Expected salary up to/), "30000");
    expect(screen.queryByRole("link", { name: "Rahul Singh" })).toBeNull();
    await user.click(screen.getByRole("link", { name: "Anjali Verma" }));
    await screen.findByRole("heading", { name: "Anjali Verma", level: 1 });
    await user.click(
      screen.getByRole("button", { name: "Shortlist candidate" }),
    );
    await screen.findByText("Application shortlisted.");
    expect(
      JSON.parse(
        localStorage.getItem("hospitality-hire-demo-v2") || "{}",
      ).applications.find((a: { id: string }) => a.id === "demo-application-2")
        .status,
    ).toBe("shortlisted");
  });
  it("approves an employer and a pending vacancy", async () => {
    nav.url = "/admin";
    const state = createDemo();
    state.role = "admin";
    state.userId = "demo-admin";
    render(<Harness state={state} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Approve employer" }));
    await waitFor(() =>
      expect(screen.queryByText("Meadow Hospitality")).toBeNull(),
    );
    await user.click(screen.getByRole("button", { name: /Vacancies/ }));
    await user.click(screen.getByRole("button", { name: "Approve vacancy" }));
    await screen.findByText("Vacancy reviews are up to date");
    expect(
      JSON.parse(
        localStorage.getItem("hospitality-hire-demo-v2") || "{}",
      ).jobs.find((j: { id: string }) => j.id === "pending-cook").status,
    ).toBe("approved");
  });
  it("shows all submitted qualifications and screening choices before moderation", async () => {
    nav.url = "/admin";
    const state = createDemo();
    state.role = "admin";
    state.userId = "demo-admin";
    const job = state.jobs.find((j) => j.id === "pending-cook")!;
    Object.assign(job, {
      employmentType: "Full-time",
      experienceMax: 4,
      skills: ["Tandoor"],
      languages: ["Hindi"],
      joiningBy: "2026-11-01",
      questions: [
        {
          id: "review-choice",
          label: "Choose your station",
          type: "choice",
          required: true,
          dealBreaker: false,
          options: ["Tandoor station", "Pastry station"],
          comparison: "equal",
          expected: "",
        },
      ],
    });
    render(<Harness state={state} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Vacancies/ }));
    await user.click(
      screen.getByRole("button", { name: "Review full details" }),
    );
    for (const label of [
      "Employment type",
      "Experience preference",
      "Skills",
      "Languages",
      "Join by",
    ])
      expect(screen.getByText(label)).toBeDefined();
    expect(screen.getByText("Full-time")).toBeDefined();
    expect(screen.getByText(/Tandoor station.*Pastry station/)).toBeDefined();
  });
});
