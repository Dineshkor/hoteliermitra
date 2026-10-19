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
import { emptyFilters } from "@/lib/domain";
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
  it("saves a job from the list and persists it", async () => {
    nav.url = "/jobs";
    render(<Harness state={createDemo()} />);
    const user = userEvent.setup();
    const buttons = await screen.findAllByRole("button", { name: "Save job" });
    await user.click(buttons[0]);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Saved job" }).length).toBe(
        1,
      ),
    );
    expect(
      JSON.parse(localStorage.getItem("hospitality-hire-demo-v2") || "{}")
        .savedJobIds,
    ).toHaveLength(1);
  });
  it("routes anonymous visitors to sign in instead of saving", async () => {
    nav.url = "/jobs";
    render(<Harness state={{ ...createDemo(), role: null, userId: null }} />);
    const links = await screen.findAllByRole("link", {
      name: "Sign in to save this job",
    });
    expect(links[0].getAttribute("href")).toContain("/login");
  });
  it("saves the current search with alerts on", async () => {
    nav.url = "/jobs?department=Kitchen";
    render(<Harness state={createDemo()} />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Save this search" }),
    );
    const input = screen.getByLabelText("Search name");
    await user.clear(input);
    await user.type(input, "Kitchen roles");
    await user.click(screen.getByRole("button", { name: "Save search" }));
    await screen.findByText(/Search saved/);
    const stored = JSON.parse(
      localStorage.getItem("hospitality-hire-demo-v2") || "{}",
    );
    expect(stored.savedSearches[0].name).toBe("Kitchen roles");
    expect(stored.savedSearches[0].alerts).toBe(true);
  });
  it("manages saved searches with match counts and alerts toggles", async () => {
    const state = createDemo();
    state.savedSearches = [
      {
        id: "s1",
        name: "Kitchen roles",
        filters: { ...emptyFilters, department: "Kitchen" },
        alerts: true,
        createdAt: new Date().toISOString(),
      },
    ];
    nav.url = "/applicant/saved";
    const user = userEvent.setup();
    render(<Harness state={state} />);
    expect(await screen.findByText("Kitchen roles")).toBeTruthy();
    expect(screen.getByText(/2 matches?/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Alerts on" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Alerts off" })).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: "Delete search" }));
    await waitFor(() => expect(screen.queryByText("Kitchen roles")).toBeNull());
  });
  it("shows an unavailable row for a saved job that is no longer public", async () => {
    const state = createDemo();
    state.savedJobIds = ["ghost-job"];
    nav.url = "/applicant/saved";
    const user = userEvent.setup();
    render(<Harness state={state} />);
    expect(
      await screen.findByText("Vacancy no longer available"),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Remove from saved" }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Vacancy no longer available")).toBeNull(),
    );
  });
});
