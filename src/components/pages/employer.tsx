"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Plus,
  Trash2,
  ClipboardList,
  UsersRound,
  CheckCircle2,
  BriefcaseBusiness,
} from "lucide-react";
import { useWorkspace } from "../workspace-provider";
import {
  Badge,
  Button,
  Empty,
  Field,
  Guard,
  LinkButton,
  Notice,
  PageHeading,
  Status,
  useTask,
} from "../ui";
import { CompanyMark } from "../job-card";
import type { Company, Job, Question } from "@/lib/types";
import {
  departments,
  propertyTypes,
  cities,
  skillsByDepartment,
  languages,
  salary,
  initials,
  uuid,
} from "@/lib/taxonomy";
import { validateJob } from "@/lib/domain";
export function EmployerDashboard() {
  return (
    <div className="container page">
      <Guard role="employer">
        <EmployerOverview />
      </Guard>
    </div>
  );
}
function EmployerOverview() {
  const { state } = useWorkspace();
  const company = state.companies.find((c) => c.ownerId === state.userId),
    jobs = state.jobs.filter((j) => j.companyId === company?.id),
    apps = state.applications.filter((a) => jobs.some((j) => j.id === a.jobId));
  return (
    <>
      <PageHeading
        eyebrow="BUILT FOR YOUR NEXT GREAT HIRE"
        title={company ? `Hello, ${company.name}.` : "Let’s build your team."}
        description="Clear vacancies. Structured profiles. Better hiring conversations."
        action={
          <LinkButton href="/employer/jobs/new" arrow>
            Post a vacancy
          </LinkButton>
        }
      />
      {!company ? (
        <Empty
          title="Your company comes first"
          description="Tell applicants who you are. Your company profile is reviewed before any vacancies go live."
          action={
            <LinkButton href="/employer/company">
              Set up company profile
            </LinkButton>
          }
        />
      ) : (
        <>
          <div className="company-status">
            <CompanyMark company={company} />
            <div>
              <strong>{company.name}</strong>
              <p className="muted">
                {company.type} · {company.city}
              </p>
            </div>
            <Status status={company.status} />
            <Link className="inline-link" href="/employer/company">
              Edit profile
            </Link>
          </div>
          {company.status !== "approved" && (
            <Notice
              message={
                company.reviewReason ||
                "Your company must be approved before vacancies can be published. You can prepare drafts in the meantime."
              }
              error={
                company.status === "rejected" || company.status === "suspended"
              }
            />
          )}
          <div className="stat-grid">
            {[
              [
                BriefcaseBusiness,
                "Published vacancies",
                jobs.filter((j) => j.status === "approved").length,
              ],
              [
                UsersRound,
                "Applications",
                state.applicationCounts
                  ? jobs.reduce(
                      (sum, j) =>
                        sum + (state.applicationCounts?.[j.id]?.total || 0),
                      0,
                    )
                  : apps.length,
              ],
              [
                CheckCircle2,
                "Shortlisted",
                state.applicationCounts
                  ? jobs.reduce(
                      (sum, j) =>
                        sum +
                        (state.applicationCounts?.[j.id]?.shortlisted || 0),
                      0,
                    )
                  : apps.filter((a) => a.status === "shortlisted").length,
              ],
              [
                ClipboardList,
                "Awaiting review",
                jobs.filter(
                  (j) =>
                    j.status === "pending" ||
                    j.pendingRevision?.status === "pending",
                ).length,
              ],
            ].map(([Icon, label, count]) => {
              const I = Icon as typeof BriefcaseBusiness;
              return (
                <div className="stat-card" key={String(label)}>
                  <I size={21} />
                  <strong>{String(count)}</strong>
                  <span>{String(label)}</span>
                </div>
              );
            })}
          </div>
          <div className="section-title">
            <h2>Your vacancies</h2>
            <Link className="inline-link" href="/employer/jobs">
              View all <ArrowRight size={17} />
            </Link>
          </div>
          <VacancyList jobs={jobs.slice(0, 5)} />
        </>
      )}
    </>
  );
}
export function CompanyEditor() {
  return (
    <div className="container page">
      <Guard role="employer">
        <CompanyForm />
      </Guard>
    </div>
  );
}
function CompanyForm() {
  const { state, mutate } = useWorkspace();
  const existing = state.companies.find((c) => c.ownerId === state.userId);
  const [c, setC] = useState<Company>(
    () =>
      existing || {
        id: uuid(),
        ownerId: state.userId || "",
        name: "",
        type: "Hotel",
        city: "",
        address: "",
        phone: "",
        email: "",
        website: "",
        description: "",
        status: "draft",
        reviewReason: "",
        initials: "",
        color: "sand",
      },
  );
  const task = useTask();
  const update = (patch: Partial<Company>) => setC({ ...c, ...patch });
  return (
    <>
      <PageHeading
        eyebrow="INTRODUCE YOUR PROPERTY"
        title="Your company profile."
        description="Help applicants know who they’ll be working with."
      />
      {existing && (
        <div className="review-banner">
          <Status status={existing.status} />
          <p>
            {existing.reviewReason ||
              "Company details are reviewed before vacancies can go live."}
          </p>
        </div>
      )}
      <form
        className="panel form-narrow"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(
            () =>
              mutate({
                action: "company.save",
                payload: {
                  ...c,
                  initials: initials(c.name),
                  status: "pending",
                },
              }),
            "Company profile submitted for review.",
          );
        }}
      >
        <h2>The essentials</h2>
        <div className="form-grid">
          <Field label="Company / property name">
            <input
              value={c.name}
              required
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Your business name"
            />
          </Field>
          <Field label="Business type">
            <select
              value={c.type}
              onChange={(e) => update({ type: e.target.value })}
            >
              {propertyTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="City">
            <input
              list="company-cities"
              value={c.city}
              onChange={(e) => update({ city: e.target.value })}
              required
            />
          </Field>
          <datalist id="company-cities">
            {cities.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </datalist>
          <Field label="Address / locality">
            <input
              value={c.address}
              onChange={(e) => update({ address: e.target.value })}
              required
            />
          </Field>
          <Field label="Business contact phone">
            <input
              type="tel"
              value={c.phone}
              onChange={(e) => update({ phone: e.target.value })}
              required
              placeholder="Mobile or landline"
            />
          </Field>
          <Field label="Business email">
            <input
              type="email"
              value={c.email}
              onChange={(e) => update({ email: e.target.value })}
              required
              placeholder="hiring@yourproperty.com"
            />
          </Field>
          <div className="full">
            <Field label="Website" optional>
              <input
                value={c.website}
                onChange={(e) => update({ website: e.target.value })}
                placeholder="https://yourproperty.com"
              />
            </Field>
          </div>
          <div className="full">
            <Field
              label="About your property"
              hint="Share the type of hospitality you offer and what your team is like."
            >
              <textarea
                rows={5}
                required
                maxLength={2000}
                value={c.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <Notice message={task.message} error={task.error} />
        <div className="form-actions">
          <Link href="/employer" className="inline-link">
            Back to overview
          </Link>
          <Button type="submit" busy={task.busy}>
            Submit for review <ArrowRight size={17} />
          </Button>
        </div>
      </form>
    </>
  );
}
export function EmployerJobs() {
  return (
    <div className="container page">
      <Guard role="employer">
        <JobsList />
      </Guard>
    </div>
  );
}
function JobsList() {
  const { state } = useWorkspace();
  const [filter, setFilter] = useState("");
  const company = state.companies.find((c) => c.ownerId === state.userId),
    jobs = state.jobs.filter(
      (j) => j.companyId === company?.id && (!filter || j.status === filter),
    );
  return (
    <>
      <PageHeading
        eyebrow="FROM VACANCY TO GREAT HIRE"
        title="Your vacancies."
        description="Manage each role and the people applying for it."
        action={
          <LinkButton href="/employer/jobs/new">
            <Plus size={17} />
            Post a vacancy
          </LinkButton>
        }
      />
      <div className="tabs">
        {["", "approved", "pending", "draft", "rejected", "closed"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={filter === s ? "selected" : ""}
          >
            {s === ""
              ? "All vacancies"
              : s === "approved"
                ? "Published"
                : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <VacancyList jobs={jobs} />
    </>
  );
}
function VacancyList({ jobs }: { jobs: Job[] }) {
  const { state, mutate } = useWorkspace();
  const task = useTask();
  return (
    <>
      <Notice message={task.message} error={task.error} />
      {jobs.length ? (
        <div className="vacancy-list">
          {jobs.map((j) => (
            <article className="panel vacancy-row" key={j.id}>
              <div>
                <div className="row-tags">
                  <Status status={j.status} />
                  {j.pendingRevision && (
                    <Badge tone="sand">
                      Revision {j.pendingRevision.status}
                    </Badge>
                  )}
                </div>
                <h3>{j.title || "Untitled draft"}</h3>
                <p className="muted">
                  {j.city || "Location needed"} · {salary(j.salaryMin)}–
                  {salary(j.salaryMax)} / month · {j.openings} openings
                </p>
                {(j.reviewReason || j.pendingRevision?.reviewReason) && (
                  <p className="review-reason">
                    Review: {j.pendingRevision?.reviewReason || j.reviewReason}
                  </p>
                )}
              </div>
              <div className="vacancy-actions">
                <Link
                  href={`/employer/jobs/${j.id}/applicants`}
                  className="button secondary"
                >
                  <UsersRound size={16} />
                  {state.applicationCounts?.[j.id]?.total ??
                    state.applications.filter((a) => a.jobId === j.id)
                      .length}{" "}
                  applicants
                </Link>
                {!["closed", "removed"].includes(j.status) && (
                  <Link
                    href={`/employer/jobs/${j.id}/edit`}
                    className="inline-link"
                  >
                    Edit vacancy
                  </Link>
                )}
                {!["closed", "removed"].includes(j.status) && (
                  <Button
                    variant="text"
                    busy={task.busy}
                    onClick={() =>
                      void task.run(
                        () =>
                          mutate({
                            action: "job.close",
                            payload: { id: j.id },
                          }),
                        "Vacancy closed. New applications are now stopped.",
                      )
                    }
                  >
                    Close
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Your next hire starts with a clear vacancy"
          description="Add the role, salary, shifts and benefits. We’ll review it before it goes live."
          action={
            <LinkButton href="/employer/jobs/new">Post a vacancy</LinkButton>
          }
        />
      )}
    </>
  );
}
export function JobEditor({ id }: { id?: string }) {
  return (
    <div className="container page">
      <Guard role="employer">
        <JobForm id={id} />
      </Guard>
    </div>
  );
}
function JobForm({ id }: { id?: string }) {
  const { state, mutate } = useWorkspace();
  const router = useRouter(),
    task = useTask();
  const company = state.companies.find((c) => c.ownerId === state.userId),
    previous = state.jobs.find(
      (j) => j.id === id && j.companyId === company?.id,
    );
  const [j, setJ] = useState<Job>(() =>
    structuredClone(
      previous?.pendingRevision ||
        previous || {
          id: uuid(),
          companyId: company?.id || "",
          version: 1,
          title: "",
          department: "Kitchen",
          role: "Commis Chef",
          city: company?.city || "",
          locality: "",
          propertyType: company?.type || "Hotel",
          employmentType: "Full time",
          experienceMin: 0,
          experienceMax: null,
          salaryMin: 0,
          salaryMax: 0,
          shift: "Rotational",
          accommodation: false,
          meals: false,
          openings: 1,
          description: "",
          skills: [],
          languages: [],
          joiningBy: "",
          questions: [],
          status: "draft",
          reviewReason: "",
          createdAt: new Date().toISOString(),
        },
    ),
  );
  const update = (patch: Partial<Job>) => setJ({ ...j, ...patch });
  const updateQ = (id: string, patch: Partial<Question>) =>
    update({
      questions: j.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    });
  if (!company)
    return (
      <Empty
        title="Create your company profile first"
        description="Every vacancy belongs to a hospitality employer."
        action={
          <LinkButton href="/employer/company">
            Create company profile
          </LinkButton>
        }
      />
    );
  if (id && !previous)
    return (
      <Empty
        title="Vacancy not found"
        description="You can only edit your own company’s vacancies."
      />
    );
  if (company.status === "suspended")
    return (
      <Empty
        title="This employer account is suspended"
        description={
          company.reviewReason ||
          "Contact the platform owner to request a review."
        }
      />
    );
  async function save(draft = false) {
    await task.run(
      async () => {
        if (!draft) {
          const errors = validateJob(j);
          if (errors.length) throw new Error(errors.join(" "));
        }
        await mutate({
          action: "job.save",
          payload: { ...j, status: draft ? "draft" : "pending" },
        });
        router.push("/employer/jobs");
      },
      draft ? "Draft saved." : "Vacancy submitted for review.",
    );
  }
  return (
    <>
      <Link href="/employer/jobs" className="back-link">
        ← Your vacancies
      </Link>
      <PageHeading
        eyebrow="A BETTER FIT STARTS WITH A CLEAR ROLE"
        title={id ? "Edit your vacancy." : "Who are you looking for?"}
        description="The details here help candidates decide—and help you filter their applications."
      />
      {previous?.status === "approved" && (
        <Notice message="Changes are reviewed as a new version. Your current approved vacancy stays public until the revision is approved." />
      )}
      <form
        className="panel job-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="form-section">
          <span className="section-number">01</span>
          <div>
            <h2>The role</h2>
            <div className="form-grid">
              <div className="full">
                <Field label="Job title">
                  <input
                    value={j.title}
                    onChange={(e) => update({ title: e.target.value })}
                    required
                    placeholder="e.g. Commis Chef · Indian Cuisine"
                  />
                </Field>
              </div>
              <Field label="Department">
                <select
                  value={j.department}
                  onChange={(e) =>
                    update({
                      department: e.target.value,
                      role: departments[e.target.value][0],
                      skills: [],
                    })
                  }
                >
                  {Object.keys(departments).map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </Field>
              <Field label="Role">
                <select
                  value={j.role}
                  onChange={(e) => update({ role: e.target.value })}
                >
                  {(departments[j.department] || []).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Employment type">
                <select
                  value={j.employmentType}
                  onChange={(e) => update({ employmentType: e.target.value })}
                >
                  {[
                    "Full time",
                    "Part time",
                    "Contract",
                    "Seasonal",
                    "Internship",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Number of openings">
                <input
                  type="number"
                  min="1"
                  required
                  step="1"
                  value={j.openings}
                  onChange={(e) => update({ openings: Number(e.target.value) })}
                />
              </Field>
              <Field label="City">
                <input
                  list="job-cities"
                  required
                  value={j.city}
                  onChange={(e) => update({ city: e.target.value })}
                />
              </Field>
              <datalist id="job-cities">
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
              <Field label="Locality / area">
                <input
                  required
                  value={j.locality}
                  onChange={(e) => update({ locality: e.target.value })}
                />
              </Field>
              <Field label="Property type">
                <select
                  value={j.propertyType}
                  onChange={(e) => update({ propertyType: e.target.value })}
                >
                  {propertyTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Shift type">
                <select
                  value={j.shift}
                  onChange={(e) => update({ shift: e.target.value })}
                >
                  {[
                    "Day shift",
                    "Evening shift",
                    "Night shift",
                    "Rotational",
                    "Split shift",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </div>
        <div className="form-section">
          <span className="section-number">02</span>
          <div>
            <h2>Experience, pay & benefits</h2>
            <div className="form-grid">
              <Field label="Minimum experience (years)">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={j.experienceMin}
                  onChange={(e) =>
                    update({ experienceMin: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Preferred upper experience" optional>
                <input
                  type="number"
                  min={j.experienceMin}
                  step="0.5"
                  value={j.experienceMax ?? ""}
                  onChange={(e) =>
                    update({
                      experienceMax: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  placeholder="No upper preference"
                />
              </Field>
              <Field label="Monthly salary minimum (₹)">
                <input
                  type="number"
                  min="1"
                  required
                  value={j.salaryMin || ""}
                  onChange={(e) =>
                    update({ salaryMin: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Monthly salary maximum (₹)">
                <input
                  type="number"
                  min={j.salaryMin || 1}
                  required
                  value={j.salaryMax || ""}
                  onChange={(e) =>
                    update({ salaryMax: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Accommodation">
                <select
                  value={String(j.accommodation)}
                  onChange={(e) =>
                    update({ accommodation: e.target.value === "true" })
                  }
                >
                  <option value="false">Not provided</option>
                  <option value="true">Provided</option>
                </select>
              </Field>
              <Field label="Meals">
                <select
                  value={String(j.meals)}
                  onChange={(e) => update({ meals: e.target.value === "true" })}
                >
                  <option value="false">Not provided</option>
                  <option value="true">Provided</option>
                </select>
              </Field>
              <Field label="Preferred joining deadline" optional>
                <input
                  type="date"
                  value={j.joiningBy}
                  onChange={(e) => update({ joiningBy: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </div>
        <div className="form-section">
          <span className="section-number">03</span>
          <div>
            <h2>What the candidate should know</h2>
            <Field label="Responsibilities & requirements">
              <textarea
                required
                rows={7}
                maxLength={6000}
                value={j.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Describe the work, your team, and the experience you need. Use short paragraphs or bullet points."
              />
            </Field>
            <div className="field">
              <span className="field-label">
                Relevant skills <small>Optional</small>
              </span>
              <div className="skill-options">
                {(skillsByDepartment[j.department] || []).map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={j.skills.includes(s) ? "selected" : ""}
                    aria-pressed={j.skills.includes(s)}
                    onClick={() =>
                      update({
                        skills: j.skills.includes(s)
                          ? j.skills.filter((x) => x !== s)
                          : [...j.skills, s],
                      })
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label">
                Preferred languages <small>Optional</small>
              </span>
              <div className="skill-options">
                {languages.map((l) => (
                  <button
                    type="button"
                    key={l}
                    className={j.languages.includes(l) ? "selected" : ""}
                    aria-pressed={j.languages.includes(l)}
                    onClick={() =>
                      update({
                        languages: j.languages.includes(l)
                          ? j.languages.filter((x) => x !== l)
                          : [...j.languages, l],
                      })
                    }
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="form-section">
          <span className="section-number">04</span>
          <div>
            <h2>Your screening questions</h2>
            <p className="muted">
              Keep it short: up to five questions. Deal-breakers are flagged for
              your review.
            </p>
            {j.questions.map((q, i) => (
              <div className="screening-builder" key={q.id}>
                <div className="entry-heading">
                  <h3>Question {i + 1}</h3>
                  <button
                    type="button"
                    className="icon-link danger"
                    aria-label={`Remove question ${i + 1}`}
                    onClick={() =>
                      update({
                        questions: j.questions.filter((x) => x.id !== q.id),
                      })
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <Field label="Question">
                  <input
                    required
                    value={q.label}
                    onChange={(e) => updateQ(q.id, { label: e.target.value })}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Answer type">
                    <select
                      value={q.type}
                      onChange={(e) => {
                        const type = e.target.value as Question["type"];
                        updateQ(q.id, {
                          type,
                          dealBreaker: type === "text" ? false : q.dealBreaker,
                          expected:
                            type === "number"
                              ? "1"
                              : type === "yesno"
                                ? "Yes"
                                : "",
                          comparison: type === "number" ? "minimum" : "equal",
                          options:
                            type === "choice" ? ["Option 1", "Option 2"] : [],
                        });
                      }}
                    >
                      <option value="yesno">Yes / No</option>
                      <option value="choice">Single choice</option>
                      <option value="number">Number</option>
                      <option value="text">Short text</option>
                    </select>
                  </Field>
                  <div className="question-flags">
                    <label>
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) =>
                          updateQ(q.id, { required: e.target.checked })
                        }
                      />
                      Required answer
                    </label>
                    {q.type !== "text" && (
                      <label>
                        <input
                          type="checkbox"
                          checked={q.dealBreaker}
                          onChange={(e) =>
                            updateQ(q.id, { dealBreaker: e.target.checked })
                          }
                        />
                        Deal-breaker
                      </label>
                    )}
                  </div>
                  {q.type === "choice" && (
                    <div className="full">
                      <Field
                        label="Choices"
                        hint="Separate choices with commas."
                      >
                        <input
                          value={q.options.join(", ")}
                          onChange={(e) =>
                            updateQ(q.id, {
                              options: e.target.value
                                .split(",")
                                .map((s) => s.trim()),
                            })
                          }
                        />
                      </Field>
                    </div>
                  )}
                  {q.dealBreaker && (
                    <>
                      <Field
                        label={
                          q.type === "number" ? "Threshold" : "Expected answer"
                        }
                      >
                        {q.type === "yesno" || q.type === "choice" ? (
                          <select
                            value={q.expected}
                            onChange={(e) =>
                              updateQ(q.id, { expected: e.target.value })
                            }
                          >
                            <option value="">Choose expected answer</option>
                            {(q.type === "yesno"
                              ? ["Yes", "No"]
                              : q.options
                            ).map((o, k) => (
                              <option key={`${o}-${k}`}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            required
                            type="number"
                            step="any"
                            value={q.expected}
                            onChange={(e) =>
                              updateQ(q.id, { expected: e.target.value })
                            }
                          />
                        )}
                      </Field>
                      {q.type === "number" && (
                        <Field label="Pass when answer is">
                          <select
                            value={q.comparison}
                            onChange={(e) =>
                              updateQ(q.id, {
                                comparison: e.target
                                  .value as Question["comparison"],
                              })
                            }
                          >
                            <option value="minimum">
                              At least the threshold
                            </option>
                            <option value="maximum">
                              At most the threshold
                            </option>
                            <option value="equal">Exactly the threshold</option>
                          </select>
                        </Field>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              disabled={j.questions.length >= 5}
              onClick={() =>
                update({
                  questions: [
                    ...j.questions,
                    {
                      id: uuid(),
                      label: "",
                      type: "yesno",
                      options: [],
                      required: true,
                      dealBreaker: false,
                      expected: "Yes",
                      comparison: "equal",
                    },
                  ],
                })
              }
            >
              <Plus size={16} />
              Add screening question
            </Button>
            <p className="field-hint">{j.questions.length} of 5 questions</p>
          </div>
        </div>
        <Notice message={task.message} error={task.error} />
        <div className="form-actions">
          <span className="muted">Reviewed before going live.</span>
          <div>
            <Button
              type="button"
              variant="secondary"
              busy={task.busy}
              onClick={() => void save(true)}
            >
              Save draft
            </Button>
            <Button type="submit" busy={task.busy}>
              Submit for review <ArrowRight size={17} />
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
