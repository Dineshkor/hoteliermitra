import type { WorkspaceAction } from "@/lib/types";

const actions = new Set([
  "profile.save",
  "company.save",
  "job.save",
  "job.close",
  "application.submit",
  "application.status",
  "company.review",
  "job.review",
  "account.suspend",
  "savedJob.toggle",
  "savedSearch.save",
  "savedSearch.delete",
  "savedSearch.alerts",
]);
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function parseAction(input: unknown): WorkspaceAction {
  if (
    !object(input) ||
    typeof input.action !== "string" ||
    !object(input.payload)
  )
    throw new Error("Invalid request");
  if (!actions.has(input.action)) throw new Error("Unsupported action");
  const payload = input.payload;
  if (
    [
      "job.close",
      "application.status",
      "company.review",
      "job.review",
      "account.suspend",
      "savedSearch.delete",
      "savedSearch.alerts",
    ].includes(input.action) &&
    (typeof payload.id !== "string" ||
      !payload.id.trim() ||
      payload.id.length > 100)
  )
    throw new Error("Record ID is required");
  if (
    input.action === "savedJob.toggle" &&
    (typeof payload.jobId !== "string" ||
      !payload.jobId.trim() ||
      payload.jobId.length > 100 ||
      typeof payload.saved !== "boolean")
  )
    throw new Error("Invalid saved job");
  if (input.action === "savedSearch.save") {
    if (
      typeof payload.name !== "string" ||
      !payload.name.trim() ||
      payload.name.length > 100 ||
      !object(payload.filters) ||
      typeof payload.alerts !== "boolean" ||
      (payload.id !== undefined &&
        (typeof payload.id !== "string" || payload.id.length > 100))
    )
      throw new Error("Invalid saved search");
  }
  if (
    input.action === "savedSearch.alerts" &&
    typeof payload.alerts !== "boolean"
  )
    throw new Error("Invalid search alerts");
  if (
    input.action === "application.status" &&
    !["submitted", "shortlisted", "rejected", "hired", "withdrawn"].includes(
      String(payload.status),
    )
  )
    throw new Error("Invalid application status");
  if (
    input.action === "company.review" &&
    !["approved", "rejected", "suspended"].includes(String(payload.status))
  )
    throw new Error("Invalid company review");
  if (
    input.action === "job.review" &&
    !["approved", "rejected", "removed"].includes(String(payload.status))
  )
    throw new Error("Invalid job review");
  if (
    input.action === "application.submit" &&
    (typeof payload.jobId !== "string" ||
      !payload.jobId ||
      !object(payload.answers))
  )
    throw new Error("Choose a job and answer its screening questions");
  if (
    ["company.review", "job.review", "account.suspend"].includes(
      input.action,
    ) &&
    (typeof payload.reason !== "string" || payload.reason.length > 2_000)
  )
    throw new Error("Provide a review reason of up to 2,000 characters");
  return input as WorkspaceAction;
}

export function publicDatabaseError(error: {
  code?: string;
  message?: string;
}): string {
  if (error.code === "P0001" && error.message?.startsWith("HH: "))
    return error.message.slice(4);
  if (error.code === "23505")
    return "This record already exists. Refresh and try again.";
  if (error.code === "42501")
    return "You do not have permission to make this change.";
  if (["22P02", "22007", "22008", "23514"].includes(error.code ?? ""))
    return "Some values are invalid. Check the form and try again.";
  return "We could not save this change. Please try again.";
}

export function safeNextPath(path: string | null): string {
  return path?.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !/[\u0000-\u001f]/.test(path)
    ? path
    : "/";
}

export function parseCandidateQuery(parameters: URLSearchParams): {
  jobId: string;
  page: number;
  filters: Record<string, string | number | boolean>;
} {
  const jobId = parameters.get("jobId")?.trim();
  if (!jobId || jobId.length > 100)
    throw new Error("Choose a job to review its candidates.");
  const page = Number(parameters.get("page") || 1);
  if (!Number.isInteger(page) || page < 1 || page > 100_000)
    throw new Error("Choose a valid page.");
  const filters: Record<string, string | number | boolean> = {};
  const applicationId = parameters.get("applicationId")?.trim();
  if (applicationId) {
    if (applicationId.length > 100) throw new Error("Application ID is too long");
    filters.applicationId = applicationId;
  }
  for (const field of [
    "experienceMin",
    "experienceMax",
    "salaryMax",
    "joiningDays",
  ]) {
    const input = parameters.get(field);
    if (!input?.trim()) continue;
    const value = Number(input);
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1_000_000_000 ||
      (field === "joiningDays" && (!Number.isInteger(value) || value > 3650))
    )
      throw new Error(`Choose a valid ${field}.`);
    filters[field] = value;
  }
  if (
    typeof filters.experienceMin === "number" &&
    typeof filters.experienceMax === "number" &&
    filters.experienceMin > filters.experienceMax
  )
    throw new Error("Minimum experience cannot exceed maximum experience.");
  for (const field of ["city", "workplace", "propertyType"]) {
    const value = parameters.get(field)?.trim();
    if (value) {
      if (value.length > 200) throw new Error("Search text is too long.");
      filters[field] = value;
    }
  }
  for (const [field, allowed] of Object.entries({
    status: ["submitted", "shortlisted", "rejected", "hired", "withdrawn"],
    screening: ["pass", "fail"],
    sort: ["newest", "experience", "salary", "joining"],
  })) {
    const value = parameters.get(field)?.trim();
    if (value) {
      if (!allowed.includes(value)) throw new Error(`Choose a valid ${field}.`);
      filters[field] = value;
    }
  }
  const relocate = parameters.get("relocate");
  if (relocate) {
    if (!["true", "false"].includes(relocate))
      throw new Error("Relocation must be true or false.");
    filters.relocate = relocate === "true";
  }
  return { jobId, page, filters };
}
