import { describe, expect, it } from "vitest";
import { applyDemoAction } from "./demo-actions";
import { createDemo, normalizeDemoState } from "./demo";
import { emptyFilters } from "./domain";
import type { SavedSearch } from "./types";
describe("local hiring journey", () => {
  it("does not publish never-submitted drafts or reopen closed jobs", () => {
    const state = createDemo();
    const employer = {
      ...state,
      role: "employer" as const,
      userId: "demo-employer",
    };
    const drafted = applyDemoAction(employer, {
      action: "job.save",
      payload: {
        ...state.jobs[0],
        title: "",
        description: "",
        salaryMin: 0,
        salaryMax: 0,
        status: "draft",
      },
    });
    expect(() =>
      applyDemoAction(
        { ...drafted, role: "admin", userId: "demo-admin" },
        {
          action: "job.review",
          payload: { id: state.jobs[0].id, status: "approved", reason: "" },
        },
      ),
    ).toThrow("pending");
    const closed = applyDemoAction(employer, {
      action: "job.close",
      payload: { id: state.jobs[0].id },
    });
    expect(() =>
      applyDemoAction(
        { ...closed, role: "admin", userId: "demo-admin" },
        {
          action: "job.review",
          payload: { id: state.jobs[0].id, status: "approved", reason: "" },
        },
      ),
    ).toThrow("closed");
  });
  it("suspends a fictional applicant account through the admin workflow", () => {
    const state = createDemo();
    const suspended = applyDemoAction(
      { ...state, role: "admin", userId: "demo-admin" },
      {
        action: "account.suspend",
        payload: { id: "demo-applicant", reason: "Test moderation reason" },
      },
    );
    expect(
      suspended.accounts?.find((a) => a.id === "demo-applicant")?.suspended,
    ).toBe(true);
    expect(() =>
      applyDemoAction(
        {
          ...suspended,
          role: "applicant",
          userId: "demo-applicant",
          suspended: true,
        },
        { action: "profile.save", payload: state.profile! },
      ),
    ).toThrow("suspended");
  });
  it("requires screening answers, submits once and preserves the saved profile", () => {
    const state = createDemo();
    expect(() =>
      applyDemoAction(state, {
        action: "application.submit",
        payload: { jobId: "commis-chef", answers: {} },
      }),
    ).toThrow("required");
    const applied = applyDemoAction(state, {
      action: "application.submit",
      payload: {
        jobId: "commis-chef",
        answers: { rotational: "Yes", kitchen: "2" },
      },
    });
    expect(applied.applications).toHaveLength(state.applications.length + 1);
    expect(() =>
      applyDemoAction(applied, {
        action: "application.submit",
        payload: {
          jobId: "commis-chef",
          answers: { rotational: "Yes", kitchen: "2" },
        },
      }),
    ).toThrow("already applied");
    const edited = applyDemoAction(applied, {
      action: "profile.save",
      payload: { ...applied.profile!, name: "Different name" },
    });
    expect(edited.applications.at(-1)?.profile.name).toBe("Aarav Sharma");
  });
  it("allows the owner to shortlist an applicant and the applicant to withdraw", () => {
    const state = createDemo();
    const applied = applyDemoAction(state, {
      action: "application.submit",
      payload: {
        jobId: "commis-chef",
        answers: { rotational: "Yes", kitchen: "2" },
      },
    });
    const id = applied.applications.at(-1)!.id;
    const shortlisted = applyDemoAction(
      { ...applied, role: "employer", userId: "demo-employer" },
      { action: "application.status", payload: { id, status: "shortlisted" } },
    );
    expect(shortlisted.applications.at(-1)?.status).toBe("shortlisted");
    const withdrawn = applyDemoAction(
      { ...shortlisted, role: "applicant", userId: "demo-applicant" },
      { action: "application.status", payload: { id, status: "withdrawn" } },
    );
    expect(withdrawn.applications.at(-1)?.status).toBe("withdrawn");
  });
  it("keeps a published version unchanged until admin approves the revision", () => {
    const state = createDemo(),
      job = state.jobs[0];
    const revised = applyDemoAction(
      { ...state, role: "employer", userId: "demo-employer" },
      {
        action: "job.save",
        payload: { ...job, title: "Updated commis role", status: "pending" },
      },
    );
    expect(revised.jobs.find((j) => j.id === job.id)?.title).toBe(job.title);
    const approved = applyDemoAction(
      { ...revised, role: "admin", userId: "demo-admin" },
      {
        action: "job.review",
        payload: { id: job.id, status: "approved", reason: "" },
      },
    );
    expect(approved.jobs.find((j) => j.id === job.id)?.title).toBe(
      "Updated commis role",
    );
  });
  it("blocks applicants from moderation and employers from closed-job edits", () => {
    const state = createDemo();
    expect(() =>
      applyDemoAction(state, {
        action: "company.review",
        payload: { id: "meadow", status: "approved", reason: "" },
      }),
    ).toThrow("admin");
    const employer = {
      ...state,
      role: "employer" as const,
      userId: "demo-employer",
    };
    const closed = applyDemoAction(employer, {
      action: "job.close",
      payload: { id: state.jobs[0].id },
    });
    expect(() =>
      applyDemoAction(closed, {
        action: "job.save",
        payload: { ...closed.jobs[0], id: state.jobs[0].id, status: "pending" },
      }),
    ).toThrow("closed");
  });
});
describe("saved jobs and searches in demo mode", () => {
  it("toggles visible saved jobs and rejects unavailable or unauthorized ones", () => {
    const state = createDemo();
    const saved = applyDemoAction(state, {
      action: "savedJob.toggle",
      payload: { jobId: "commis-chef", saved: true },
    });
    expect(saved.savedJobIds).toContain("commis-chef");
    const unsaved = applyDemoAction(saved, {
      action: "savedJob.toggle",
      payload: { jobId: "commis-chef", saved: false },
    });
    expect(unsaved.savedJobIds).toEqual([]);
    expect(() =>
      applyDemoAction(state, {
        action: "savedJob.toggle",
        payload: { jobId: "pending-cook", saved: true },
      }),
    ).toThrow("not available");
    expect(() =>
      applyDemoAction(
        { ...state, role: "employer", userId: "demo-employer" },
        {
          action: "savedJob.toggle",
          payload: { jobId: "commis-chef", saved: true },
        },
      ),
    ).toThrow("Switch to the applicant demo");
  });
  it("caps saved jobs at 500", () => {
    const state = {
      ...createDemo(),
      savedJobIds: Array.from({ length: 500 }, (_, i) => `job-${i}`),
    };
    expect(() =>
      applyDemoAction(state, {
        action: "savedJob.toggle",
        payload: { jobId: "commis-chef", saved: true },
      }),
    ).toThrow("up to 500");
    const removed = applyDemoAction(state, {
      action: "savedJob.toggle",
      payload: { jobId: "job-0", saved: false },
    });
    expect(removed.savedJobIds).toHaveLength(499);
  });
  it("saves, updates, toggles and deletes searches with normalized filters", () => {
    const state = createDemo();
    const saved = applyDemoAction(state, {
      action: "savedSearch.save",
      payload: {
        id: "",
        name: " Weekend chefs ",
        filters: { ...emptyFilters, q: "chef", department: "Kitchen" },
        alerts: true,
        createdAt: "2026-10-19T00:00:00.000Z",
      },
    });
    expect(saved.savedSearches).toHaveLength(1);
    const search = saved.savedSearches[0];
    expect(search.name).toBe("Weekend chefs");
    expect(search.filters).toEqual({
      ...emptyFilters,
      q: "chef",
      department: "Kitchen",
    });
    expect(search.alerts).toBe(true);
    const updated = applyDemoAction(saved, {
      action: "savedSearch.save",
      payload: { ...search, name: "Kitchen roles", alerts: false },
    });
    expect(updated.savedSearches).toHaveLength(1);
    expect(updated.savedSearches[0].name).toBe("Kitchen roles");
    expect(updated.savedSearches[0].alerts).toBe(false);
    expect(updated.savedSearches[0].createdAt).toBe(search.createdAt);
    const on = applyDemoAction(updated, {
      action: "savedSearch.alerts",
      payload: { id: search.id, alerts: true },
    });
    expect(on.savedSearches[0].alerts).toBe(true);
    const removed = applyDemoAction(on, {
      action: "savedSearch.delete",
      payload: { id: search.id },
    });
    expect(removed.savedSearches).toEqual([]);
    expect(() =>
      applyDemoAction(state, {
        action: "savedSearch.delete",
        payload: { id: "missing" },
      }),
    ).toThrow("Search not found");
    expect(() =>
      applyDemoAction(state, {
        action: "savedSearch.save",
        payload: {
          id: "missing",
          name: "Kitchen roles",
          filters: emptyFilters,
          alerts: true,
          createdAt: "2026-10-19T00:00:00.000Z",
        },
      }),
    ).toThrow("Search not found");
    expect(() =>
      applyDemoAction(state, {
        action: "savedSearch.save",
        payload: {
          id: "",
          name: "Bad",
          filters: { ...emptyFilters, department: "Astrology" },
          alerts: true,
          createdAt: "2026-10-19T00:00:00.000Z",
        },
      }),
    ).toThrow();
  });
  it("caps saved searches at 50", () => {
    const searches: SavedSearch[] = Array.from({ length: 50 }, (_, i) => ({
      id: `s-${i}`,
      name: `Search ${i}`,
      filters: emptyFilters,
      alerts: true,
      createdAt: "2026-10-19T00:00:00.000Z",
    }));
    const state = { ...createDemo(), savedSearches: searches };
    expect(() =>
      applyDemoAction(state, {
        action: "savedSearch.save",
        payload: {
          id: "",
          name: "One more",
          filters: emptyFilters,
          alerts: true,
          createdAt: "2026-10-19T00:00:00.000Z",
        },
      }),
    ).toThrow("up to 50");
  });
});
describe("legacy demo state", () => {
  it("normalizes persisted state missing saved fields instead of resetting", () => {
    const legacy = structuredClone(createDemo()) as Record<string, unknown>;
    delete legacy.savedJobIds;
    delete legacy.savedSearches;
    const normalized = normalizeDemoState(legacy);
    expect(normalized.savedJobIds).toEqual([]);
    expect(normalized.savedSearches).toEqual([]);
    expect(normalized.profile?.name).toBe("Aarav Sharma");
    expect(normalizeDemoState("nonsense").jobs.length).toBeGreaterThan(0);
    expect(normalizeDemoState(null).companies.length).toBeGreaterThan(0);
  });
});
