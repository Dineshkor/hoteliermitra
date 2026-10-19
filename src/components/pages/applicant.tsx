"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  UserRound,
  MapPin,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Bell,
  BellOff,
  Bookmark,
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
import { JobCard } from "../job-card";
import { blankProfile } from "@/lib/demo";
import {
  validateProfile,
  evaluateScreening,
  answerFor,
  getFitIndicators,
  publicJobs,
  jobMatchesFilters,
  describeFilters,
  filtersToSearchParams,
} from "@/lib/domain";
import {
  cities,
  departments,
  languages,
  propertyTypes,
  skillsByDepartment,
  dateLabel,
  salary,
  uuid,
  initials,
} from "@/lib/taxonomy";
import type {
  Answers,
  ApplicantProfile,
  Application,
  WorkExperience,
} from "@/lib/types";
export function Profile() {
  return (
    <div className="container page">
      <Guard role="applicant">
        <ProfileForm />
      </Guard>
    </div>
  );
}
function ProfileForm() {
  const { state, mutate } = useWorkspace();
  const router = useRouter(),
    params = useSearchParams();
  const [p, setP] = useState<ApplicantProfile>(
    () => state.profile || blankProfile(state.userId || ""),
  );
  const [step, setStep] = useState(0);
  const [certificationText, setCertificationText] = useState(
    p.certifications.join(", "),
  );
  const [preferredCityText, setPreferredCityText] = useState(
    p.preferredCities.join(", "),
  );
  const task = useTask();
  const fields = (update: Partial<ApplicantProfile>) =>
    setP((previous) => ({ ...previous, ...update }));
  const updateWork = (id: string, update: Partial<WorkExperience>) =>
    fields({
      workHistory: p.workHistory.map((w) =>
        w.id === id ? { ...w, ...update } : w,
      ),
    });
  async function next() {
    const ok = await task.run(
      async () => {
        if (step === 1 && p.experience > 0 && !p.workHistory.length)
          throw new Error(
            "Add your most recent workplace, or set your experience to fresher.",
          );
        if (step === 2 && !p.languages.length)
          throw new Error("Select at least one spoken language.");
        if (step === 3) {
          const errors = validateProfile(p);
          if (errors.length) throw new Error(errors.join(" "));
        }
        await mutate({ action: "profile.save", payload: p });
      },
      step === 3
        ? "Your profile is ready. You can use it for every application."
        : "Progress saved.",
    );
    if (ok) {
      if (step < 3) {
        setStep(step + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const next = params.get("returnTo");
        if (next?.startsWith("/jobs/") && !next.includes("//"))
          router.push(next);
      }
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ONE PROFILE. EVERY OPPORTUNITY."
        title="Tell us about you."
        description="A few useful details help the right employer see your fit."
      />
      <div className="profile-layout">
        <aside className="profile-progress">
          <p className="eyebrow">YOUR PROFILE</p>
          {[
            "The basics",
            "Your experience",
            "Skills & languages",
            "Salary & availability",
          ].map((label, i) => (
            <button
              key={label}
              className={step === i ? "current" : i < step ? "done" : ""}
              onClick={() => setStep(i)}
            >
              <span>{i < step ? <Check size={15} /> : i + 1}</span>
              <div>
                <strong>{label}</strong>
                <small>
                  {
                    [
                      "Who you are and what you do",
                      "The places you’ve worked",
                      "What you bring to the team",
                      "Your next role, on your terms",
                    ][i]
                  }
                </small>
              </div>
            </button>
          ))}
          <div className="profile-tip">
            <ShieldCheck size={24} />
            <h3>Shared when you apply</h3>
            <p>
              Your salary and contact details are only shown to employers you
              apply to.
            </p>
          </div>
        </aside>
        <form
          className="panel profile-form"
          onSubmit={(e) => {
            e.preventDefault();
            void next();
          }}
        >
          <div className="form-step-heading">
            <Badge tone="green">Step {step + 1} of 4</Badge>
            <h2>
              {
                [
                  "Let’s start with the basics.",
                  "Your hospitality experience.",
                  "The skills behind your service.",
                  "What works for you?",
                ][step]
              }
            </h2>
            <p className="muted">
              {
                [
                  "Only the details that help employers understand your profile.",
                  "Your most recent workplace is enough to get started.",
                  "Select what you know. No long descriptions needed.",
                  "Clear expectations make better conversations.",
                ][step]
              }
            </p>
          </div>
          {step === 0 && (
            <div className="form-grid">
              <Field label="Full name">
                <input
                  value={p.name}
                  onChange={(e) => fields({ name: e.target.value })}
                  autoComplete="name"
                  required
                  placeholder="Your full name"
                />
              </Field>
              <Field label="Contact phone">
                <input
                  type="tel"
                  value={p.phone}
                  onChange={(e) => fields({ phone: e.target.value })}
                  autoComplete="tel"
                  required
                  placeholder="10-digit mobile number"
                />
              </Field>
              <Field label="Email" optional>
                <input
                  type="email"
                  value={p.email}
                  onChange={(e) => fields({ email: e.target.value })}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Current city">
                <input
                  value={p.city}
                  onChange={(e) => fields({ city: e.target.value })}
                  list="profile-cities"
                  required
                  placeholder="Where do you live?"
                />
              </Field>
              <datalist id="profile-cities">
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
              <Field label="Department">
                <select
                  value={p.department}
                  onChange={(e) =>
                    fields({
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
              <Field label="Primary role">
                <select
                  value={p.role}
                  onChange={(e) => fields({ role: e.target.value })}
                >
                  {(departments[p.department] || []).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Total experience (years)"
                hint="Enter 0 if you’re starting your hospitality career."
              >
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="60"
                  step="0.5"
                  value={p.experience}
                  onChange={(e) =>
                    fields({ experience: Number(e.target.value) })
                  }
                  required
                />
              </Field>
            </div>
          )}
          {step === 1 && (
            <>
              {p.experience === 0 && (
                <Notice message="Starting your career? You can skip work history and continue." />
              )}
              {p.workHistory.map((w, i) => (
                <div className="work-entry" key={w.id}>
                  <div className="entry-heading">
                    <h3>Workplace {i + 1}</h3>
                    <button
                      type="button"
                      className="icon-link danger"
                      aria-label={`Remove workplace ${i + 1}`}
                      onClick={() =>
                        fields({
                          workHistory: p.workHistory.filter(
                            (x) => x.id !== w.id,
                          ),
                        })
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <Field label="Employer or property">
                      <input
                        required
                        value={w.employer}
                        onChange={(e) =>
                          updateWork(w.id, { employer: e.target.value })
                        }
                        placeholder="Name of the place you worked"
                      />
                    </Field>
                    <Field label="Property type">
                      <select
                        value={w.propertyType}
                        onChange={(e) =>
                          updateWork(w.id, { propertyType: e.target.value })
                        }
                      >
                        {propertyTypes.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Your role">
                      <input
                        required
                        value={w.role}
                        onChange={(e) =>
                          updateWork(w.id, { role: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Start month">
                      <input
                        type="month"
                        required
                        max={new Date().toISOString().slice(0, 7)}
                        value={w.start}
                        onChange={(e) =>
                          updateWork(w.id, { start: e.target.value })
                        }
                      />
                    </Field>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={w.current}
                        onChange={(e) =>
                          updateWork(w.id, {
                            current: e.target.checked,
                            end: e.target.checked ? "" : w.end,
                          })
                        }
                      />
                      I currently work here
                    </label>
                    {!w.current && (
                      <Field label="End month">
                        <input
                          type="month"
                          min={w.start}
                          max={new Date().toISOString().slice(0, 7)}
                          required
                          value={w.end}
                          onChange={(e) =>
                            updateWork(w.id, { end: e.target.value })
                          }
                        />
                      </Field>
                    )}
                    <div className="full">
                      <Field
                        label="Reason for leaving / seeking change"
                        optional
                      >
                        <input
                          value={w.reason}
                          maxLength={250}
                          onChange={(e) =>
                            updateWork(w.id, { reason: e.target.value })
                          }
                          placeholder="A brief reason, if you want to share"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  fields({
                    workHistory: [
                      ...p.workHistory,
                      {
                        id: uuid(),
                        employer: "",
                        propertyType: "Hotel",
                        role: p.role,
                        start: "",
                        end: "",
                        current: false,
                        reason: "",
                      },
                    ],
                  })
                }
              >
                <Plus size={17} />
                Add workplace
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <div className="field">
                <span className="field-label">
                  Your skills <small>Optional</small>
                </span>
                <p className="field-hint">
                  Choose the skills relevant to your department.
                </p>
                <div className="skill-options">
                  {(skillsByDepartment[p.department] || []).map((s) => (
                    <button
                      type="button"
                      key={s}
                      className={p.skills.includes(s) ? "selected" : ""}
                      aria-pressed={p.skills.includes(s)}
                      onClick={() =>
                        fields({
                          skills: p.skills.includes(s)
                            ? p.skills.filter((x) => x !== s)
                            : [...p.skills, s],
                        })
                      }
                    >
                      {p.skills.includes(s) && <Check size={14} />} {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span className="field-label">Languages you speak</span>
                <div className="language-grid">
                  {languages.map((l) => {
                    const selected = p.languages.find((x) => x.name === l);
                    return (
                      <div className="language-entry" key={l}>
                        <label>
                          <input
                            type="checkbox"
                            checked={!!selected}
                            onChange={(e) =>
                              fields({
                                languages: e.target.checked
                                  ? [
                                      ...p.languages,
                                      { name: l, proficiency: "Working" },
                                    ]
                                  : p.languages.filter((x) => x.name !== l),
                              })
                            }
                          />
                          {l}
                        </label>
                        {selected && (
                          <select
                            aria-label={`${l} proficiency`}
                            value={selected.proficiency}
                            onChange={(e) =>
                              fields({
                                languages: p.languages.map((x) =>
                                  x.name === l
                                    ? { ...x, proficiency: e.target.value }
                                    : x,
                                ),
                              })
                            }
                          >
                            <option>Basic</option>
                            <option>Working</option>
                            <option>Fluent</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <Field
                label="Certifications"
                optional
                hint="Separate multiple certificates with commas. No document upload needed."
              >
                <input
                  value={certificationText}
                  onChange={(e) => {
                    setCertificationText(e.target.value);
                    fields({
                      certifications: e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    });
                  }}
                  placeholder="Food safety, hotel management diploma…"
                />
              </Field>
            </>
          )}
          {step === 3 && (
            <div className="form-grid">
              <Field label="Expected monthly salary (₹)">
                <input
                  required
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={p.expectedSalary || ""}
                  onChange={(e) =>
                    fields({ expectedSalary: Number(e.target.value) })
                  }
                  placeholder="e.g. 25000"
                />
              </Field>
              <Field label="Current monthly salary (₹)" optional>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={p.currentSalary ?? ""}
                  onChange={(e) =>
                    fields({
                      currentSalary: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  placeholder="Leave blank if not applicable"
                />
              </Field>
              <Field label="Notice period">
                <select
                  value={p.noticeDays}
                  onChange={(e) =>
                    fields({ noticeDays: Number(e.target.value) })
                  }
                >
                  {[0, 7, 15, 30, 45, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d === 0 ? "Available immediately" : `${d} days`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Earliest joining date">
                <input
                  type="date"
                  required
                  value={p.availableFrom}
                  onChange={(e) => fields({ availableFrom: e.target.value })}
                />
              </Field>
              <div className="full">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={p.relocate}
                    onChange={(e) => fields({ relocate: e.target.checked })}
                  />
                  I’m willing to relocate for the right role
                </label>
              </div>
              {p.relocate && (
                <div className="full">
                  <Field
                    label="Preferred cities"
                    optional
                    hint="Separate with commas. Leave blank if you’re open to any city."
                  >
                    <input
                      value={preferredCityText}
                      onChange={(e) => {
                        setPreferredCityText(e.target.value);
                        fields({
                          preferredCities: e.target.value
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean),
                        });
                      }}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}
          <Notice message={task.message} error={task.error} />
          <div className="form-actions">
            {step > 0 ? (
              <Button
                variant="secondary"
                type="button"
                onClick={() => setStep(step - 1)}
              >
                Back
              </Button>
            ) : (
              <span />
            )}
            <div>
              <Button
                type="button"
                variant="text"
                busy={task.busy}
                onClick={() =>
                  void task.run(
                    () => mutate({ action: "profile.save", payload: p }),
                    "Progress saved. You can return any time.",
                  )
                }
              >
                Save for later
              </Button>
              <Button type="submit" busy={task.busy}>
                {step === 3 ? "Save my profile" : "Save & continue"}
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
export function ProfileSummary({ profile: p }: { profile: ApplicantProfile }) {
  return (
    <div className="profile-summary">
      <div className="candidate-heading">
        <span className="avatar">{initials(p.name)}</span>
        <div>
          <h3>{p.name}</h3>
          <p>
            {p.role} · {p.department}
          </p>
        </div>
      </div>
      <div className="summary-facts">
        <span>
          <MapPin size={15} />
          {p.city}
        </span>
        <span>
          <BriefcaseBusiness size={15} />
          {p.experience} years
        </span>
        <span>{salary(p.expectedSalary)} / month</span>
        <span>
          <CalendarDays size={15} />
          {dateLabel(p.availableFrom)}
        </span>
      </div>
      <div className="job-tags">
        {p.skills.map((s) => (
          <Badge key={s}>{s}</Badge>
        ))}
      </div>
    </div>
  );
}
export function Apply({ id }: { id: string }) {
  return (
    <div className="container page">
      <Guard role="applicant">
        <ApplyForm id={id} />
      </Guard>
    </div>
  );
}
function ApplyForm({ id }: { id: string }) {
  const { state, mutate } = useWorkspace();
  const router = useRouter(),
    task = useTask();
  const [answers, setAnswers] = useState<Answers>({});
  const job = publicJobs(state.jobs, state.companies).find((j) => j.id === id),
    profile = state.profile;
  if (!job)
    return (
      <Empty
        title="This vacancy is not accepting applications"
        description="Find another role that fits your experience."
        action={<LinkButton href="/jobs">Browse jobs</LinkButton>}
      />
    );
  if (
    state.applications.some(
      (a) => a.jobId === id && a.applicantId === state.userId,
    )
  )
    return (
      <Empty
        title="You’ve already applied"
        description="Your profile and screening answers have been submitted. Follow the status in your applications."
        action={
          <LinkButton href="/applicant/applications">
            My applications
          </LinkButton>
        }
      />
    );
  const errors = profile
    ? validateProfile(profile)
    : ["Create your profile first."];
  if (errors.length)
    return (
      <>
        <PageHeading
          title="A few details before you apply."
          description="Complete your reusable profile once. Future applications will be much quicker."
        />
        <div className="panel">
          <h3>What’s still needed</h3>
          <ul className="error-list">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <LinkButton
            href={`/applicant/profile?returnTo=${encodeURIComponent(`/jobs/${id}/apply`)}`}
            arrow
          >
            Complete my profile
          </LinkButton>
        </div>
      </>
    );
  const screening = evaluateScreening(job.questions, answers);
  return (
    <>
      <Link className="back-link" href={`/jobs/${id}`}>
        ← Back to vacancy
      </Link>
      <PageHeading
        eyebrow="YOUR PROFILE HANDLES THE REST"
        title={`Apply for ${job.title}`}
        description={`${state.companies.find((c) => c.id === job.companyId)?.name} · ${job.city}`}
      />
      <div className="apply-layout">
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              await mutate({
                action: "application.submit",
                payload: { jobId: id, answers },
              });
              router.push("/applicant/applications");
            }, "Application submitted.");
          }}
        >
          <h2>
            {job.questions.length
              ? "Just a few questions."
              : "You’re ready to apply."}
          </h2>
          <p className="muted">
            Your saved profile will be shared with this employer.
          </p>
          <div className="screening-form">
            {job.questions.map((q) => (
              <div key={q.id}>
                <Field
                  label={q.label}
                  optional={!q.required}
                  hint={
                    q.dealBreaker
                      ? "This is a hiring requirement. Your answer is shown to the employer."
                      : undefined
                  }
                >
                  {q.type === "yesno" || q.type === "choice" ? (
                    <select
                      required={q.required}
                      value={answerFor(answers, q.id)}
                      onChange={(e) =>
                        setAnswers({ ...answers, [q.id]: e.target.value })
                      }
                    >
                      <option value="">Choose an answer</option>
                      {(q.type === "yesno" ? ["Yes", "No"] : q.options).map(
                        (o) => (
                          <option key={o}>{o}</option>
                        ),
                      )}
                    </select>
                  ) : q.type === "number" ? (
                    <input
                      required={q.required}
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={answerFor(answers, q.id)}
                      onChange={(e) =>
                        setAnswers({ ...answers, [q.id]: e.target.value })
                      }
                    />
                  ) : (
                    <textarea
                      required={q.required}
                      rows={3}
                      maxLength={500}
                      value={answerFor(answers, q.id)}
                      onChange={(e) =>
                        setAnswers({ ...answers, [q.id]: e.target.value })
                      }
                    />
                  )}
                </Field>
                {answerFor(answers, q.id) &&
                  screening.find((r) => r.questionId === q.id)?.passed ===
                    false && (
                    <p className="screening-warning">
                      <AlertCircle size={14} />
                      This answer may not meet the requirement. You can still
                      submit for review.
                    </p>
                  )}
              </div>
            ))}
          </div>
          <div className="application-consent">
            <ShieldCheck size={20} />
            <p>
              By submitting, you share this profile and its contact details with
              the employer for this vacancy. A copy is saved with your
              application.
            </p>
          </div>
          <Notice message={task.message} error={task.error} />
          <Button type="submit" busy={task.busy}>
            Submit application <ArrowRight size={17} />
          </Button>
        </form>
        <aside className="panel">
          <div className="section-title">
            <h3>Your profile</h3>
            <Link
              className="inline-link"
              href={`/applicant/profile?returnTo=${encodeURIComponent(`/jobs/${id}/apply`)}`}
            >
              Edit
            </Link>
          </div>
          <ProfileSummary profile={profile!} />
          <h3>Your fit at a glance</h3>
          <div className="fit-list">
            {getFitIndicators(profile!, job, answers)
              .filter((f) => !job.questions.some((q) => q.label === f.label))
              .map((f) => (
                <span key={f.label} className={f.result}>
                  {f.result === "pass" ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}{" "}
                  {f.label}
                  <span className="sr-only">
                    :{" "}
                    {f.result === "pass"
                      ? "Met"
                      : f.result === "fail"
                        ? "Not met"
                        : "Unknown"}
                  </span>
                </span>
              ))}
          </div>
          <small className="muted">
            Based on your self-reported profile and the listed requirements.
          </small>
        </aside>
      </div>
    </>
  );
}
export function Applications() {
  return (
    <div className="container page">
      <Guard role="applicant">
        <ApplicationList />
      </Guard>
    </div>
  );
}
function ApplicationList() {
  const { state, mutate } = useWorkspace(),
    task = useTask();
  const [filter, setFilter] = useState("");
  const all = state.applications.filter((a) => a.applicantId === state.userId),
    apps = all
      .filter((a) => !filter || a.status === filter)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return (
    <>
      <PageHeading
        eyebrow="EVERY APPLICATION, IN ONE PLACE"
        title="Your next step starts here."
        description="Follow your applications and see when an employer updates their decision."
        action={
          <LinkButton href="/jobs" variant="secondary">
            Explore more jobs <ArrowUpRightIcon />
          </LinkButton>
        }
      />
      <div className="tabs">
        {["", "submitted", "shortlisted", "rejected", "hired", "withdrawn"].map(
          (s) => (
            <button
              key={s}
              className={filter === s ? "selected" : ""}
              onClick={() => setFilter(s)}
            >
              {s ? `${s[0].toUpperCase()}${s.slice(1)}` : "All applications"}
              {s === "" && <span>{all.length}</span>}
            </button>
          ),
        )}
      </div>
      <Notice message={task.message} error={task.error} />
      {apps.length ? (
        <div className="application-list">
          {apps.map((a) => (
            <ApplicationCard
              key={a.id}
              application={a}
              onWithdraw={() =>
                void task.run(
                  () =>
                    mutate({
                      action: "application.status",
                      payload: { id: a.id, status: "withdrawn" },
                    }),
                  "Application withdrawn.",
                )
              }
              busy={task.busy}
            />
          ))}
        </div>
      ) : (
        <Empty
          title={
            all.length
              ? "No applications with this status"
              : "Your first opportunity is waiting"
          }
          description="Apply using your saved profile. Your application updates will appear here."
          action={
            <LinkButton href="/jobs" arrow>
              Find a role
            </LinkButton>
          }
        />
      )}
    </>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={16} />;
}
function ApplicationCard({
  application: a,
  onWithdraw,
  busy,
}: {
  application: Application;
  onWithdraw: () => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { state } = useWorkspace();
  const job = state.jobs.find((j) => j.id === a.jobId);
  return (
    <article className="panel application-card">
      <div className="application-card-head">
        <div>
          <p className="eyebrow">
            {state.companies.find((c) => c.id === a.jobSnapshot.companyId)
              ?.name || "Hospitality employer"}
          </p>
          <h3>
            <Link href={`/jobs/${a.jobId}`}>{a.jobSnapshot.title}</Link>
          </h3>
          <p className="muted">
            {a.jobSnapshot.city} · Applied {dateLabel(a.submittedAt)}
          </p>
        </div>
        <Status status={a.status} />
      </div>
      {job && ["closed", "removed"].includes(job.status) && (
        <p className="muted">This vacancy is now {job.status}.</p>
      )}
      <div className="application-card-actions">
        <button className="inline-link" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide details" : "View submitted details"}
        </button>
        {["submitted", "shortlisted"].includes(a.status) && (
          <Button variant="text" busy={busy} onClick={onWithdraw}>
            Withdraw application
          </Button>
        )}
      </div>
      {expanded && (
        <div className="submitted-details">
          <p className="eyebrow">YOUR SUBMITTED PROFILE</p>
          <ProfileSummary profile={a.profile} />
          <h4>Screening answers</h4>
          {a.jobSnapshot.questions.length ? (
            a.jobSnapshot.questions.map((q) => (
              <p key={q.id}>
                <strong>{q.label}</strong>
                <br />
                {answerFor(a.answers, q.id) || "Not answered"}
              </p>
            ))
          ) : (
            <p>No screening questions for this role.</p>
          )}
          <h4>Status history</h4>
          <ol className="timeline">
            {a.events.map((e, i) => (
              <li key={i}>
                <Status status={e.status} />
                <span>{dateLabel(e.at)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}
export function ApplicantDashboard() {
  const { state } = useWorkspace();
  return (
    <div className="container page">
      <Guard role="applicant">
        <PageHeading
          eyebrow="YOUR HOSPITALITY CAREER"
          title={`Welcome${state.profile?.name ? `, ${state.profile.name.split(" ")[0]}` : ""}.`}
          description="One profile. A world of hospitality opportunities."
        />
        <div className="dashboard-grid">
          <div className="panel">
            <UserRound size={27} />
            <h2>Your reusable profile</h2>
            <p className="muted">
              {state.profile && !validateProfile(state.profile).length
                ? "Your profile is ready for applications."
                : "Complete a few details to apply for your first role."}
            </p>
            <LinkButton href="/applicant/profile" variant="secondary">
              Update my profile
            </LinkButton>
          </div>
          <div className="panel">
            <BriefcaseBusiness size={27} />
            <h2>Your applications</h2>
            <p className="muted">
              See employer decisions and the details you submitted.
            </p>
            <LinkButton href="/applicant/applications" variant="secondary">
              View applications
            </LinkButton>
          </div>
          <div className="panel">
            <Bookmark size={27} />
            <h2>Saved jobs & alerts</h2>
            <p className="muted">
              Keep shortlisted vacancies and daily alerts for your searches in
              one place.
            </p>
            <LinkButton href="/applicant/saved" variant="secondary">
              View saved jobs
            </LinkButton>
          </div>
          <div className="panel">
            <ShieldCheck size={27} />
            <h2>Your next opportunity</h2>
            <p className="muted">
              Explore reviewed hospitality vacancies across India.
            </p>
            <LinkButton href="/jobs">Find a role</LinkButton>
          </div>
        </div>
      </Guard>
    </div>
  );
}
export function Saved() {
  return (
    <div className="container page">
      <Guard role="applicant">
        <SavedContent />
      </Guard>
    </div>
  );
}
function SavedContent() {
  const { state, mutate } = useWorkspace(),
    task = useTask();
  const visible = publicJobs(state.jobs, state.companies);
  const searches = [...state.savedSearches].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const companyName = (jobId: string) => {
    const job = state.jobs.find((j) => j.id === jobId);
    return state.companies.find((c) => c.id === job?.companyId)?.name;
  };
  return (
    <>
      <PageHeading
        eyebrow="YOUR SHORTLIST AND DAILY ALERTS"
        title="Saved jobs and searches."
        description="Keep an eye on the roles you want. When new vacancies match a saved search, your daily alert will list them."
        action={
          <LinkButton href="/jobs" variant="secondary">
            Explore more jobs <ArrowRight size={16} />
          </LinkButton>
        }
      />
      <Notice message={task.message} error={task.error} />
      <div className="section-title">
        <h2>Saved jobs</h2>
        <span className="muted">{state.savedJobIds.length} saved</span>
      </div>
      {state.savedJobIds.length ? (
        <div className="job-grid">
          {state.savedJobIds.map((jobId) => {
            const job = visible.find((j) => j.id === jobId);
            if (job)
              return (
                <JobCard
                  key={jobId}
                  job={job}
                  company={state.companies.find((c) => c.id === job.companyId)}
                />
              );
            return (
              <article className="panel saved-unavailable" key={jobId}>
                <h3>Vacancy no longer available</h3>
                <p className="muted">
                  This role has closed or is no longer public.
                </p>
                <Button
                  variant="secondary"
                  busy={task.busy}
                  onClick={() =>
                    void task.run(
                      () =>
                        mutate({
                          action: "savedJob.toggle",
                          payload: { jobId, saved: false },
                        }),
                      "Removed from saved jobs.",
                    )
                  }
                >
                  Remove from saved
                </Button>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="No saved jobs yet"
          description="Tap the bookmark icon on any vacancy to keep it here."
          action={<LinkButton href="/jobs">Browse jobs</LinkButton>}
        />
      )}
      <section className="saved-section">
        <div className="section-title">
          <h2>Saved searches</h2>
          <span className="muted">{searches.length} saved</span>
        </div>
        {searches.length ? (
          <div className="saved-searches-grid">
            {searches.map((s) => {
              const count = visible.filter((j) =>
                jobMatchesFilters(j, companyName(j.id), s.filters),
              ).length;
              return (
                <article className="panel saved-search-card" key={s.id}>
                  <h3>{s.name}</h3>
                  <p className="muted">{describeFilters(s.filters)}</p>
                  <p>
                    {`${count} ${count === 1 ? "match" : "matches"} right now`}
                  </p>
                  <div className="saved-search-actions">
                    <LinkButton
                      href={`/jobs?${filtersToSearchParams(s.filters).toString()}`}
                      variant="secondary"
                    >
                      Open search
                    </LinkButton>
                    <Button
                      variant="text"
                      busy={task.busy}
                      aria-pressed={s.alerts}
                      onClick={() =>
                        void task.run(
                          () =>
                            mutate({
                              action: "savedSearch.alerts",
                              payload: { id: s.id, alerts: !s.alerts },
                            }),
                          s.alerts ? "Daily alerts paused." : "Daily alerts are on.",
                        )
                      }
                    >
                      {s.alerts ? (
                        <>
                          <Bell size={15} /> Alerts on
                        </>
                      ) : (
                        <>
                          <BellOff size={15} /> Alerts off
                        </>
                      )}
                    </Button>
                    <Button
                      variant="text"
                      busy={task.busy}
                      onClick={() =>
                        void task.run(
                          () =>
                            mutate({
                              action: "savedSearch.delete",
                              payload: { id: s.id },
                            }),
                          "Search deleted.",
                        )
                      }
                    >
                      <Trash2 size={15} /> Delete search
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty
            title="No saved searches yet"
            description="Filter the jobs page to what you want, then save the search for daily alerts."
            action={<LinkButton href="/jobs">Start a search</LinkButton>}
          />
        )}
      </section>
    </>
  );
}
