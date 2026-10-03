import { describe, expect, it } from "vitest";
import {
  validateProfile,
  validateJob,
  evaluateScreening,
  getFitIndicators,
  filterApplications,
  transitionAllowed,
  makeApplication,
  publicJobs,
} from "./domain";
import type { ApplicantProfile, Company, Job, Question } from "./types";
const profile: ApplicantProfile = {
  id: "candidate",
  name: "Aarav",
  phone: "9876543210",
  email: "",
  city: "Mumbai",
  department: "Kitchen",
  role: "Commis Chef",
  experience: 2,
  workHistory: [
    {
      id: "w",
      employer: "Palm House",
      propertyType: "Hotel",
      role: "Commis Chef",
      start: "2024-01",
      end: "",
      current: true,
      reason: "",
    },
  ],
  skills: ["Indian cuisine"],
  certifications: [],
  languages: [{ name: "Hindi", proficiency: "Fluent" }],
  currentSalary: 20000,
  expectedSalary: 25000,
  noticeDays: 15,
  availableFrom: "2026-10-20",
  relocate: true,
  preferredCities: [],
};
const job: Job = {
  id: "job",
  companyId: "co",
  version: 1,
  title: "Commis Chef",
  department: "Kitchen",
  role: "Commis Chef",
  city: "Goa",
  locality: "Panaji",
  propertyType: "Hotel",
  employmentType: "Full time",
  experienceMin: 1,
  experienceMax: null,
  salaryMin: 22000,
  salaryMax: 30000,
  shift: "Rotational",
  accommodation: true,
  meals: true,
  openings: 2,
  description: "Prepare fresh food and maintain kitchen hygiene.",
  skills: [],
  languages: [],
  joiningBy: "2026-11-01",
  questions: [],
  status: "approved",
  reviewReason: "",
  createdAt: "2026-10-01",
};
const question: Question = {
  id: "q",
  label: "Can you work rotating shifts?",
  type: "yesno",
  options: [],
  required: true,
  dealBreaker: true,
  expected: "Yes",
  comparison: "equal",
};
describe("profile readiness", () => {
  it("rejects a phone number with no actual digits", () =>
    expect(validateProfile({ ...profile, phone: "----------" })).toContain(
      "Enter a valid contact phone number.",
    ));
  it("requires work history for an experienced applicant", () =>
    expect(validateProfile({ ...profile, workHistory: [] })).toContain(
      "Add your most recent workplace.",
    ));
  it("lets freshers skip work history", () =>
    expect(
      validateProfile({ ...profile, experience: 0, workHistory: [] }),
    ).toEqual([]));
  it("requires an expected monthly salary", () =>
    expect(validateProfile({ ...profile, expectedSalary: 0 })).toContain(
      "Enter your expected monthly salary.",
    ));
});
describe("vacancy and screening", () => {
  it("requires structured property, employment, and shift details", () =>
    expect(
      validateJob({ ...job, propertyType: "", employmentType: "", shift: "" }),
    ).toContain("Choose a hospitality property, employment type, and shift."));
  it("rejects roles outside the selected hospitality department", () =>
    expect(
      validateJob({ ...job, department: "Front Office", role: "Commis Chef" }),
    ).toContain("Choose a role from the selected hospitality department."));
  it("rejects reversed salary ranges", () =>
    expect(validateJob({ ...job, salaryMin: 35000 })).toContain(
      "Minimum salary cannot exceed maximum salary.",
    ));
  it("rejects a free-text deal-breaker", () =>
    expect(
      validateJob({ ...job, questions: [{ ...question, type: "text" }] }),
    ).toContain("Deal-breakers need a yes/no, choice, or numeric answer."));
  it("marks an unanswered mandatory question as failed", () =>
    expect(evaluateScreening([question], {})[0]?.passed).toBe(false));
  it("ignores inherited answer keys but accepts explicitly answered keys", () => {
    for (const id of ["constructor", "__proto__", "toString"]) {
      const reserved = { ...question, id };
      expect(evaluateScreening([reserved], {})[0]?.passed).toBe(false);
      expect(
        evaluateScreening([reserved], { [id]: reserved.expected })[0]?.passed,
      ).toBe(true);
    }
    const inherited = Object.create({ q: question.expected });
    expect(evaluateScreening([question], inherited)[0]?.passed).toBe(false);
  });
  it("evaluates numeric minimums without treating an empty answer as zero", () => {
    const numeric: Question = {
      ...question,
      type: "number",
      expected: "2",
      comparison: "minimum",
    };
    expect(evaluateScreening([numeric], { q: "3" })[0]?.passed).toBe(true);
    expect(
      evaluateScreening([{ ...numeric, required: false }], {})[0]?.passed,
    ).toBeNull();
  });
});
describe("application decisions", () => {
  it("shows when a candidate's role differs from the vacancy", () =>
    expect(
      getFitIndicators({ ...profile, role: "Sous Chef" }, job, {}),
    ).toContainEqual({ label: "Same role", result: "fail" }));
  it("shows salary and relocation comparisons transparently", () => {
    const indicators = getFitIndicators(profile, job, {});
    expect(indicators).toContainEqual({
      label: "Salary within range",
      result: "pass",
    });
    expect(indicators).toContainEqual({
      label: "Location or relocation",
      result: "pass",
    });
  });
  it("preserves the profile and job at submission", () => {
    const p = structuredClone(profile),
      j = structuredClone(job);
    const app = makeApplication(p, j, {}, "2026-10-02T00:00:00Z");
    p.name = "Changed";
    j.salaryMax = 1;
    expect(app.profile?.name).toBe("Aarav");
    expect(app.jobSnapshot?.salaryMax).toBe(30000);
  });
  it("filters work history and salary together", () => {
    const app = makeApplication(profile, job, {}, "2026-10-02T00:00:00Z");
    expect(
      filterApplications([app], {
        salaryMax: 26000,
        workplace: "palm",
        propertyType: "Hotel",
      }),
    ).toHaveLength(1);
    expect(filterApplications([app], { salaryMax: 24000 })).toHaveLength(0);
  });
  it("restricts withdrawal to applicant and employer decisions to employer", () => {
    expect(transitionAllowed("submitted", "shortlisted", "applicant")).toBe(
      false,
    );
    expect(transitionAllowed("submitted", "shortlisted", "employer")).toBe(
      true,
    );
    expect(transitionAllowed("withdrawn", "hired", "employer")).toBe(false);
  });
  it("hides approved jobs when the company is suspended", () => {
    const company = { id: "co", status: "suspended" } as Company;
    expect(publicJobs([job], [company])).toEqual([]);
    expect(
      publicJobs([job], [{ ...company, status: "approved" }]),
    ).toHaveLength(1);
  });
});
