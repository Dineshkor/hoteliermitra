import type {
  ApplicantProfile,
  Application,
  ApplicationStatus,
  Answers,
  Company,
  FitIndicator,
  Job,
  Question,
  Role,
  ScreeningResult,
} from "./types";
import { departments, propertyTypes } from "./taxonomy";
export type CandidateFilters = {
  status?: string;
  experienceMin?: number;
  experienceMax?: number;
  salaryMax?: number;
  joiningDays?: number;
  city?: string;
  workplace?: string;
  propertyType?: string;
  relocate?: boolean;
  screening?: string;
  sort?: string;
};
export function validateProfile(p: ApplicantProfile): string[] {
  const errors: string[] = [];
  if (!p.name.trim()) errors.push("Enter your name.");
  const digitCount = p.phone.replace(/\D/g, "").length;
  if (!/^\+?[\d\s-]+$/.test(p.phone) || digitCount < 10 || digitCount > 15)
    errors.push("Enter a valid contact phone number.");
  if (!p.city.trim()) errors.push("Choose your current city.");
  if (!p.department || !p.role) errors.push("Choose your department and role.");
  else if (!departments[p.department]?.includes(p.role))
    errors.push("Choose a role from the selected hospitality department.");
  if (!Number.isFinite(p.experience) || p.experience < 0)
    errors.push("Experience cannot be negative.");
  if (p.experience > 0 && !p.workHistory.length)
    errors.push("Add your most recent workplace.");
  if (
    p.workHistory.some(
      (w) =>
        !w.employer.trim() ||
        !w.role ||
        !w.propertyType ||
        !w.start ||
        (!w.current && (!w.end || w.end < w.start)),
    )
  )
    errors.push("Complete your workplace details and check the dates.");
  if (!p.languages.length) errors.push("Add at least one spoken language.");
  if (!Number.isFinite(p.expectedSalary) || p.expectedSalary <= 0)
    errors.push("Enter your expected monthly salary.");
  if (
    p.currentSalary !== null &&
    (!Number.isFinite(p.currentSalary) || p.currentSalary < 0)
  )
    errors.push("Current salary cannot be negative.");
  if (!Number.isFinite(p.noticeDays) || p.noticeDays < 0)
    errors.push("Choose a valid notice period.");
  if (!p.availableFrom || Number.isNaN(Date.parse(p.availableFrom)))
    errors.push("Choose when you can join.");
  return errors;
}
export function validateJob(j: Job): string[] {
  const errors: string[] = [];
  if (!departments[j.department]?.includes(j.role))
    errors.push("Choose a role from the selected hospitality department.");
  if (
    !propertyTypes.includes(j.propertyType) ||
    !["Full time", "Part time", "Contract", "Seasonal", "Internship"].includes(
      j.employmentType,
    ) ||
    ![
      "Day shift",
      "Evening shift",
      "Night shift",
      "Rotational",
      "Split shift",
    ].includes(j.shift)
  )
    errors.push("Choose a hospitality property, employment type, and shift.");
  if (!j.title.trim() || !j.role || !j.department)
    errors.push("Choose a job title, department, and role.");
  if (!j.city.trim() || !j.locality.trim())
    errors.push("Enter the job city and locality.");
  if (!j.description.trim())
    errors.push("Describe the role and responsibilities.");
  if (
    !Number.isFinite(j.salaryMin) ||
    !Number.isFinite(j.salaryMax) ||
    j.salaryMin <= 0 ||
    j.salaryMax <= 0
  )
    errors.push("Enter a positive monthly salary range.");
  if (j.salaryMin > j.salaryMax)
    errors.push("Minimum salary cannot exceed maximum salary.");
  if (!Number.isInteger(j.openings) || j.openings < 1)
    errors.push("Enter at least one opening.");
  if (
    j.experienceMin < 0 ||
    (j.experienceMax !== null && j.experienceMax < j.experienceMin)
  )
    errors.push("Check the experience range.");
  if (j.questions.length > 5)
    errors.push("Keep screening to five questions or fewer.");
  if (new Set(j.questions.map((q) => q.id)).size !== j.questions.length)
    errors.push("Screening question identifiers must be unique.");
  for (const q of j.questions) {
    if (
      !q.id.trim() ||
      q.id.length > 100 ||
      Object.hasOwn(Object.prototype, q.id)
    )
      errors.push("Use a valid screening question identifier.");
    if (!q.label.trim()) errors.push("Give every screening question a label.");
    if (
      q.type === "choice" &&
      (q.options.length < 2 || q.options.some((o) => !o.trim()))
    )
      errors.push("Choice questions need at least two options.");
    if (q.dealBreaker && q.type === "text")
      errors.push("Deal-breakers need a yes/no, choice, or numeric answer.");
    if (
      q.dealBreaker &&
      (!q.expected.trim() ||
        (q.type === "number" && !Number.isFinite(Number(q.expected))))
    )
      errors.push("Set a valid expected answer for each deal-breaker.");
    if (
      q.dealBreaker &&
      q.type === "yesno" &&
      !["Yes", "No"].includes(q.expected)
    )
      errors.push("Choose Yes or No for the expected answer.");
    if (q.dealBreaker && q.type === "choice" && !q.options.includes(q.expected))
      errors.push("Expected answers must be one of the choices.");
  }
  return [...new Set(errors)];
}
export function answerFor(answers: Answers, questionId: string): string {
  const value = Object.hasOwn(answers, questionId)
    ? answers[questionId]
    : undefined;
  return typeof value === "string" ? value : "";
}
export function evaluateScreening(
  questions: Question[],
  answers: Answers,
): ScreeningResult[] {
  return questions.map((q) => {
    const answer = answerFor(answers, q.id).trim();
    let passed: boolean | null = null;
    if (!answer) passed = q.required ? false : null;
    else if (q.type === "number" && !Number.isFinite(Number(answer)))
      passed = false;
    else if (q.type === "yesno" && !["Yes", "No"].includes(answer))
      passed = false;
    else if (q.type === "choice" && !q.options.includes(answer)) passed = false;
    else if (q.dealBreaker && q.type !== "text")
      passed =
        q.type === "number"
          ? q.comparison === "minimum"
            ? Number(answer) >= Number(q.expected)
            : q.comparison === "maximum"
              ? Number(answer) <= Number(q.expected)
              : Number(answer) === Number(q.expected)
          : answer === q.expected;
    return {
      questionId: q.id,
      label: q.label,
      passed,
      dealBreaker: q.dealBreaker,
    };
  });
}
export function getFitIndicators(
  p: ApplicantProfile,
  j: Job,
  answers: Answers,
): FitIndicator[] {
  const flag = (value: boolean): "pass" | "fail" => (value ? "pass" : "fail");
  const fits: FitIndicator[] = [
    { label: "Same department", result: flag(p.department === j.department) },
    { label: "Same role", result: flag(p.role === j.role) },
    {
      label: "Meets minimum experience",
      result: flag(p.experience >= j.experienceMin),
    },
    {
      label: "Salary within range",
      result:
        p.expectedSalary > 0
          ? flag(p.expectedSalary <= j.salaryMax)
          : "unknown",
    },
    {
      label: "Location or relocation",
      result: flag(
        p.city.toLowerCase() === j.city.toLowerCase() ||
          (p.relocate &&
            (!p.preferredCities.length ||
              p.preferredCities.some(
                (c) => c.toLowerCase() === j.city.toLowerCase(),
              ))),
      ),
    },
  ];
  if (j.joiningBy)
    fits.push({
      label: "Available by joining date",
      result: p.availableFrom
        ? flag(p.availableFrom <= j.joiningBy)
        : "unknown",
    });
  for (const result of evaluateScreening(j.questions, answers).filter(
    (r) => r.dealBreaker,
  ))
    fits.push({
      label: result.label,
      result: result.passed === null ? "unknown" : flag(result.passed),
    });
  return fits;
}
export function filterApplications(
  applications: Application[],
  f: CandidateFilters,
): Application[] {
  const today = new Date().toISOString().slice(0, 10);
  const filtered = applications.filter((a) => {
    const p = a.profile;
    if (f.status && a.status !== f.status) return false;
    if (f.experienceMin !== undefined && p.experience < f.experienceMin)
      return false;
    if (f.experienceMax !== undefined && p.experience > f.experienceMax)
      return false;
    if (f.salaryMax !== undefined && p.expectedSalary > f.salaryMax)
      return false;
    if (
      f.joiningDays !== undefined &&
      Math.max(
        0,
        (Date.parse(p.availableFrom) - Date.parse(today)) / 86400000,
      ) > f.joiningDays
    )
      return false;
    if (f.city && !p.city.toLowerCase().includes(f.city.toLowerCase()))
      return false;
    if (f.relocate !== undefined && p.relocate !== f.relocate) return false;
    if (
      f.workplace &&
      !p.workHistory.some((w) =>
        w.employer.toLowerCase().includes(f.workplace!.toLowerCase()),
      )
    )
      return false;
    if (
      f.propertyType &&
      !p.workHistory.some((w) => w.propertyType === f.propertyType)
    )
      return false;
    const fails = a.screening.some((r) => r.dealBreaker && r.passed !== true);
    if (f.screening === "pass" && fails) return false;
    if (f.screening === "fail" && !fails) return false;
    return true;
  });
  return filtered.sort((a, b) =>
    f.sort === "experience"
      ? b.profile.experience - a.profile.experience
      : f.sort === "salary"
        ? a.profile.expectedSalary - b.profile.expectedSalary
        : f.sort === "joining"
          ? a.profile.availableFrom.localeCompare(b.profile.availableFrom)
          : b.submittedAt.localeCompare(a.submittedAt),
  );
}
export function transitionAllowed(
  from: ApplicationStatus,
  to: ApplicationStatus,
  role: Role,
): boolean {
  if (["withdrawn", "hired", "rejected"].includes(from)) return false;
  if (role === "applicant") return to === "withdrawn";
  return (
    role === "employer" &&
    ["shortlisted", "rejected", "hired"].includes(to) &&
    from !== to
  );
}
export function makeApplication(
  profile: ApplicantProfile,
  job: Job,
  answers: Answers,
  at: string,
): Application {
  return {
    id: crypto.randomUUID(),
    jobId: job.id,
    jobVersion: job.version,
    applicantId: profile.id,
    profile: structuredClone(profile),
    jobSnapshot: structuredClone(job),
    answers: structuredClone(answers),
    screening: evaluateScreening(job.questions, answers),
    status: "submitted",
    submittedAt: at,
    events: [{ status: "submitted", at }],
  };
}
export function publicJobs(jobs: Job[], companies: Company[]): Job[] {
  return jobs.filter(
    (j) =>
      j.status === "approved" &&
      companies.some((c) => c.id === j.companyId && c.status === "approved"),
  );
}
