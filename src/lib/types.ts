export type Role = "applicant" | "employer" | "admin";
export type ReviewStatus =
  "draft" | "pending" | "approved" | "rejected" | "suspended";
export type ApplicationStatus =
  "submitted" | "shortlisted" | "rejected" | "hired" | "withdrawn";
export type WorkExperience = {
  id: string;
  employer: string;
  propertyType: string;
  role: string;
  start: string;
  end: string;
  current: boolean;
  reason: string;
};
export type ApplicantProfile = {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  department: string;
  role: string;
  experience: number;
  workHistory: WorkExperience[];
  skills: string[];
  certifications: string[];
  languages: { name: string; proficiency: string }[];
  currentSalary: number | null;
  expectedSalary: number;
  noticeDays: number;
  availableFrom: string;
  relocate: boolean;
  preferredCities: string[];
};
export type Company = {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  status: ReviewStatus;
  reviewReason: string;
  initials: string;
  color: string;
};
export type Question = {
  id: string;
  label: string;
  type: "yesno" | "choice" | "number" | "text";
  options: string[];
  required: boolean;
  dealBreaker: boolean;
  expected: string;
  comparison: "equal" | "minimum" | "maximum";
};
export type Job = {
  id: string;
  companyId: string;
  version: number;
  title: string;
  department: string;
  role: string;
  city: string;
  locality: string;
  propertyType: string;
  employmentType: string;
  experienceMin: number;
  experienceMax: number | null;
  salaryMin: number;
  salaryMax: number;
  shift: string;
  accommodation: boolean;
  meals: boolean;
  openings: number;
  description: string;
  skills: string[];
  languages: string[];
  joiningBy: string;
  questions: Question[];
  status: ReviewStatus | "closed" | "removed";
  reviewReason: string;
  createdAt: string;
  pendingRevision?: Job;
};
export type Answers = Record<string, string>;
export type JobFilters = {
  q: string;
  city: string;
  department: string;
  propertyType: string;
  salaryMin: number;
  stay: boolean;
  meals: boolean;
  sort: "newest" | "salary";
};
export type SavedSearch = {
  id: string;
  name: string;
  filters: JobFilters;
  alerts: boolean;
  createdAt: string;
};
export type ScreeningResult = {
  questionId: string;
  label: string;
  passed: boolean | null;
  dealBreaker: boolean;
};
export type FitIndicator = {
  label: string;
  result: "pass" | "fail" | "unknown";
};
export type Application = {
  id: string;
  jobId: string;
  jobVersion: number;
  applicantId: string;
  profile: ApplicantProfile;
  jobSnapshot: Job;
  answers: Answers;
  screening: ScreeningResult[];
  status: ApplicationStatus;
  submittedAt: string;
  events: { status: ApplicationStatus; at: string }[];
};
export type ModerationEvent = {
  id: string;
  targetId: string;
  action: string;
  reason: string;
  at: string;
};
export type Workspace = {
  role: Role | null;
  userId: string | null;
  profile: ApplicantProfile | null;
  companies: Company[];
  jobs: Job[];
  applications: Application[];
  moderation: ModerationEvent[];
  savedJobIds: string[];
  savedSearches: SavedSearch[];
  suspended?: boolean;
  suspensionReason?: string;
  accounts?: { id: string; role: Role; name: string; suspended: boolean }[];
  applicationCounts?: Record<
    string,
    { total: number; submitted: number; shortlisted: number }
  >;
};
export type WorkspaceAction =
  | { action: "profile.save"; payload: ApplicantProfile }
  | { action: "company.save"; payload: Company }
  | { action: "job.save"; payload: Job }
  | { action: "job.close"; payload: { id: string } }
  | {
      action: "application.submit";
      payload: { jobId: string; answers: Answers };
    }
  | {
      action: "application.status";
      payload: { id: string; status: ApplicationStatus };
    }
  | {
      action: "company.review";
      payload: {
        id: string;
        status: "approved" | "rejected" | "suspended";
        reason: string;
      };
    }
  | {
      action: "job.review";
      payload: {
        id: string;
        status: "approved" | "rejected" | "removed";
        reason: string;
      };
    }
  | { action: "account.suspend"; payload: { id: string; reason: string } }
  | {
      action: "savedJob.toggle";
      payload: { jobId: string; saved: boolean };
    }
  | { action: "savedSearch.save"; payload: SavedSearch }
  | { action: "savedSearch.delete"; payload: { id: string } }
  | { action: "savedSearch.alerts"; payload: { id: string; alerts: boolean } };
