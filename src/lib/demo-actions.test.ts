import { describe, expect, it } from "vitest";
import { applyDemoAction } from "./demo-actions";
import { createDemo } from "./demo";
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
