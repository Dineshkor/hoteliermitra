import type { Role, Workspace, WorkspaceAction } from "./types";
import { blankProfile } from "./demo";
import {
  makeApplication,
  answerFor,
  transitionAllowed,
  validateJob,
  validateProfile,
} from "./domain";
export function applyDemoAction(
  state: Workspace,
  command: WorkspaceAction,
): Workspace {
  const next = structuredClone(state),
    { action, payload } = command;
  const now = new Date().toISOString();
  const requireRole = (role: Role) => {
    if (next.suspended) throw new Error("This account is suspended.");
    if (next.role !== role)
      throw new Error(`Switch to the ${role} demo to use this action.`);
  };
  if (action === "profile.save") {
    requireRole("applicant");
    next.profile = { ...payload, id: "demo-applicant" };
  }
  if (action === "company.save") {
    requireRole("employer");
    const existing = next.companies.find((c) => c.ownerId === "demo-employer");
    if (existing?.status === "suspended")
      throw new Error("This employer account is suspended.");
    const company = {
      ...payload,
      id: existing?.id || payload.id,
      ownerId: "demo-employer",
      status:
        existing?.status === "approved"
          ? ("pending" as const)
          : payload.status === "draft"
            ? ("draft" as const)
            : ("pending" as const),
      reviewReason: "",
    };
    next.companies = next.companies
      .filter((c) => c.id !== company.id)
      .concat(company);
  }
  if (action === "job.save") {
    requireRole("employer");
    const company = next.companies.find(
      (c) => c.id === payload.companyId && c.ownerId === "demo-employer",
    );
    if (!company || company.status === "suspended")
      throw new Error("Create an active company profile first.");
    if (payload.status !== "draft") {
      const errors = validateJob(payload);
      if (errors.length) throw new Error(errors.join(" "));
    }
    const previous = next.jobs.find((j) => j.id === payload.id);
    if (previous && ["closed", "removed"].includes(previous.status))
      throw new Error("This job is closed. Create a new vacancy.");
    if (previous && previous.companyId !== company.id)
      throw new Error("You can only edit your own vacancies.");
    const job = {
      ...payload,
      status:
        payload.status === "draft" ? ("draft" as const) : ("pending" as const),
      version: (previous?.version || 0) + 1,
      createdAt: previous?.createdAt || now,
      reviewReason: "",
    };
    next.jobs = next.jobs
      .filter((j) => j.id !== job.id)
      .concat(
        previous?.status === "approved"
          ? { ...previous, pendingRevision: job }
          : job,
      );
  }
  if (action === "job.close") {
    requireRole("employer");
    const job = next.jobs.find((j) => j.id === payload.id);
    if (
      !job ||
      !next.companies.some(
        (c) => c.id === job.companyId && c.ownerId === "demo-employer",
      )
    )
      throw new Error("Vacancy not found.");
    job.status = "closed";
    delete job.pendingRevision;
  }
  if (action === "application.submit") {
    requireRole("applicant");
    const job = next.jobs.find(
      (j) => j.id === payload.jobId && j.status === "approved",
    );
    if (
      !job ||
      !next.companies.some(
        (c) => c.id === job.companyId && c.status === "approved",
      )
    )
      throw new Error("This vacancy is no longer accepting applications.");
    if (
      next.applications.some(
        (a) => a.jobId === job.id && a.applicantId === "demo-applicant",
      )
    )
      throw new Error("You have already applied to this vacancy.");
    const profile = next.profile || blankProfile("demo-applicant"),
      errors = validateProfile(profile);
    if (errors.length) throw new Error(errors.join(" "));
    if (
      job.questions.some(
        (q) => q.required && !answerFor(payload.answers, q.id).trim(),
      )
    )
      throw new Error("Answer every required screening question.");
    if (
      job.questions.some(
        (q) =>
          answerFor(payload.answers, q.id).trim() &&
          ((q.type === "number" &&
            !Number.isFinite(Number(answerFor(payload.answers, q.id)))) ||
            (q.type === "choice" &&
              !q.options.includes(answerFor(payload.answers, q.id))) ||
            (q.type === "yesno" &&
              !["Yes", "No"].includes(answerFor(payload.answers, q.id)))),
      )
    )
      throw new Error("Check your screening answers.");
    next.applications.push(makeApplication(profile, job, payload.answers, now));
  }
  if (action === "application.status") {
    const app = next.applications.find((a) => a.id === payload.id);
    if (
      !app ||
      !next.role ||
      !transitionAllowed(app.status, payload.status, next.role)
    )
      throw new Error("This status change is not available.");
    if (next.role === "applicant" && app.applicantId !== "demo-applicant")
      throw new Error("Application not found.");
    if (
      next.role === "employer" &&
      !next.companies.some(
        (c) =>
          c.id === app.jobSnapshot.companyId &&
          c.ownerId === "demo-employer" &&
          c.status !== "suspended",
      )
    )
      throw new Error("Application not found.");
    app.status = payload.status;
    app.events.push({ status: payload.status, at: now });
  }
  if (action === "company.review" || action === "job.review") {
    requireRole("admin");
    if (payload.status !== "approved" && !payload.reason.trim())
      throw new Error("Add a reason for this moderation decision.");
    if (action === "company.review") {
      const company = next.companies.find((c) => c.id === payload.id);
      if (!company) throw new Error("Company not found.");
      company.status = payload.status;
      company.reviewReason = payload.reason;
    } else {
      const job = next.jobs.find((j) => j.id === payload.id);
      if (!job) throw new Error("Vacancy not found.");
      if (payload.status !== "removed") {
        if (["closed", "removed"].includes(job.status))
          throw new Error("This job is closed. Create a new vacancy.");
        const revision = job.pendingRevision || job;
        if (revision.status !== "pending")
          throw new Error("Only pending vacancies can be reviewed.");
        if (payload.status === "approved") {
          const errors = validateJob(revision);
          if (errors.length) throw new Error(errors.join(" "));
        }
      }
      if (
        payload.status === "approved" &&
        !next.companies.some(
          (c) => c.id === job.companyId && c.status === "approved",
        )
      )
        throw new Error("Approve the employer account first.");
      if (job.pendingRevision && payload.status !== "removed") {
        if (payload.status === "approved") {
          next.jobs = next.jobs.map((j) =>
            j.id === job.id
              ? {
                  ...job.pendingRevision!,
                  status: "approved",
                  reviewReason: "",
                }
              : j,
          );
        } else {
          job.pendingRevision.status = "rejected";
          job.pendingRevision.reviewReason = payload.reason;
        }
      } else {
        job.status = payload.status;
        job.reviewReason = payload.reason;
        if (payload.status === "removed") delete job.pendingRevision;
      }
    }
    next.moderation.unshift({
      id: crypto.randomUUID(),
      targetId: payload.id,
      action: payload.status,
      reason: payload.reason,
      at: now,
    });
  }
  if (action === "account.suspend") {
    requireRole("admin");
    if (!payload.reason.trim()) throw new Error("Add a reason for suspension.");
    const account = next.accounts?.find((a) => a.id === payload.id);
    if (!account || account.role === "admin")
      throw new Error("Account not available for suspension.");
    account.suspended = true;
    next.companies
      .filter((c) => c.ownerId === account.id)
      .forEach((c) => {
        c.status = "suspended";
        c.reviewReason = payload.reason;
      });
    next.moderation.unshift({
      id: crypto.randomUUID(),
      targetId: payload.id,
      action: "suspended",
      reason: payload.reason,
      at: now,
    });
  }
  return next;
}
