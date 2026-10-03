"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Phone,
  Mail,
  SlidersHorizontal,
  CalendarDays,
  MapPin,
} from "lucide-react";
import { useWorkspace } from "../workspace-provider";
import {
  Badge,
  Button,
  Empty,
  Field,
  Guard,
  Loading,
  Notice,
  PageHeading,
  Status,
  useTask,
} from "../ui";
import {
  filterApplications,
  answerFor,
  getFitIndicators,
  transitionAllowed,
  type CandidateFilters,
} from "@/lib/domain";
import { propertyTypes, salary, dateLabel, initials } from "@/lib/taxonomy";
import type { Application, ApplicationStatus } from "@/lib/types";
import { ProfileSummary } from "./applicant";
export function Candidates({ id }: { id: string }) {
  return (
    <div className="container page">
      <Guard role="employer">
        <CandidateList id={id} />
      </Guard>
    </div>
  );
}
function CandidateList({ id }: { id: string }) {
  const { state, demo } = useWorkspace();
  const [f, setF] = useState<CandidateFilters>({}),
    [page, setPage] = useState(1),
    [remote, setRemote] = useState<{
      applications: Application[];
      total: number;
      loading: boolean;
      error: string;
    }>({ applications: [], total: 0, loading: true, error: "" });
  const job = state.jobs.find(
    (j) =>
      j.id === id &&
      state.companies.some(
        (c) => c.id === j.companyId && c.ownerId === state.userId,
      ),
  );
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setRemote((previous) => ({ ...previous, loading: true, error: "" }));
      try {
        const params = new URLSearchParams({ jobId: id, page: String(page) });
        Object.entries(f).forEach(([k, v]) => {
          if (v !== undefined && v !== "") params.set(k, String(v));
        });
        const response = await fetch(`/api/candidates?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Could not load candidates.");
        setRemote({
          applications: result.applications,
          total: result.total,
          loading: false,
          error: "",
        });
      } catch (e) {
        if (!controller.signal.aborted)
          setRemote((previous) => ({
            ...previous,
            loading: false,
            error:
              e instanceof Error ? e.message : "Could not load candidates.",
          }));
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [demo, id, f, page, state.applications]);
  if (!job)
    return (
      <Empty
        title="Vacancy not found"
        description="Your own vacancies and their applicants appear here."
      />
    );
  const filtered = filterApplications(
      state.applications.filter((a) => a.jobId === id),
      f,
    ),
    apps = demo
      ? filtered.slice((page - 1) * 12, page * 12)
      : remote.applications,
    total = demo ? filtered.length : remote.total;
  const update = (patch: Partial<CandidateFilters>) => {
    setF({ ...f, ...patch });
    setPage(1);
  };
  return (
    <>
      <Link className="back-link" href="/employer/jobs">
        ← Your vacancies
      </Link>
      <PageHeading
        eyebrow="THE DETAILS BEFORE THE CONVERSATION"
        title={`Applicants for ${job.title}`}
        description={`${job.city} · ${salary(job.salaryMin)}–${salary(job.salaryMax)} / month`}
      />
      <div className="candidate-layout">
        <aside className="filter-panel">
          <div className="filter-heading">
            <h3>
              <SlidersHorizontal size={17} /> Find the right fit
            </h3>
            <button
              className="text-button"
              onClick={() => {
                setF({});
                setPage(1);
              }}
            >
              Clear
            </button>
          </div>
          <Field label="Application status">
            <select
              value={f.status || ""}
              onChange={(e) => update({ status: e.target.value })}
            >
              <option value="">All statuses</option>
              {[
                "submitted",
                "shortlisted",
                "rejected",
                "hired",
                "withdrawn",
              ].map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-grid tight">
            <Field label="Min. years">
              <input
                type="number"
                min="0"
                step="0.5"
                value={f.experienceMin ?? ""}
                onChange={(e) =>
                  update({
                    experienceMin: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </Field>
            <Field label="Max. years">
              <input
                type="number"
                min="0"
                step="0.5"
                value={f.experienceMax ?? ""}
                onChange={(e) =>
                  update({
                    experienceMax: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </Field>
          </div>
          <Field label="Expected salary up to (₹)">
            <input
              type="number"
              min="0"
              value={f.salaryMax ?? ""}
              onChange={(e) =>
                update({
                  salaryMax: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              placeholder="e.g. 30000"
            />
          </Field>
          <Field label="Can join within">
            <select
              value={f.joiningDays ?? ""}
              onChange={(e) =>
                update({
                  joiningDays: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            >
              <option value="">Any joining time</option>
              {[0, 7, 15, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? "Immediately" : `${d} days`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Current city">
            <input
              value={f.city || ""}
              onChange={(e) => update({ city: e.target.value })}
              placeholder="e.g. Mumbai"
            />
          </Field>
          <Field label="Previous workplace">
            <input
              value={f.workplace || ""}
              onChange={(e) => update({ workplace: e.target.value })}
              placeholder="Employer or property name"
            />
          </Field>
          <Field label="Previous property type">
            <select
              value={f.propertyType || ""}
              onChange={(e) => update({ propertyType: e.target.value })}
            >
              <option value="">Any property type</option>
              {propertyTypes.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Relocation">
            <select
              value={f.relocate === undefined ? "" : String(f.relocate)}
              onChange={(e) =>
                update({
                  relocate: e.target.value
                    ? e.target.value === "true"
                    : undefined,
                })
              }
            >
              <option value="">Any preference</option>
              <option value="true">Willing to relocate</option>
              <option value="false">Not relocating</option>
            </select>
          </Field>
          <Field label="Deal-breaker answers">
            <select
              value={f.screening || ""}
              onChange={(e) => update({ screening: e.target.value })}
            >
              <option value="">All answers</option>
              <option value="pass">All requirements met</option>
              <option value="fail">Needs review / requirement not met</option>
            </select>
          </Field>
        </aside>
        <div>
          <div className="results-heading">
            <p>
              <strong>{total}</strong>{" "}
              {total === 1 ? "candidate" : "candidates"}
            </p>
            <label>
              Sort{" "}
              <select
                aria-label="Sort candidates"
                value={f.sort || "newest"}
                onChange={(e) => update({ sort: e.target.value })}
              >
                <option value="newest">Newest first</option>
                <option value="experience">Most experience</option>
                <option value="salary">Lowest salary expectation</option>
                <option value="joining">Earliest joining</option>
              </select>
            </label>
          </div>
          {!demo && remote.error && <Notice message={remote.error} error />}
          {!demo && remote.loading ? (
            <Loading />
          ) : apps.length ? (
            <div className="candidate-list">
              {apps.map((a) => (
                <CandidateCard key={a.id} application={a} />
              ))}
            </div>
          ) : (
            <Empty
              title="No candidates match these filters"
              description="Try a wider range or clear the filters to see all applications."
            />
          )}
          {total > 12 && (
            <div className="pagination">
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {Math.ceil(total / 12)}
              </span>
              <Button
                variant="secondary"
                disabled={page * 12 >= total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function CandidateCard({ application: a }: { application: Application }) {
  const p = a.profile,
    fit = getFitIndicators(p, a.jobSnapshot, a.answers),
    fail = a.screening.some((s) => s.dealBreaker && s.passed !== true);
  return (
    <article className="panel candidate-card">
      <div className="candidate-card-heading">
        <span className="avatar">{initials(p.name)}</span>
        <div>
          <Link
            href={`/employer/jobs/${a.jobId}/applicants/${a.id}`}
            className="candidate-name"
          >
            {p.name}
          </Link>
          <p>
            {p.role} · {p.experience} years’ experience
          </p>
        </div>
        <Status status={a.status} />
      </div>
      <div className="candidate-metrics">
        <span>
          <MapPin size={15} />
          {p.city}
        </span>
        <span>
          <strong>{salary(p.expectedSalary)}</strong> / month
        </span>
        <span>
          <CalendarDays size={15} />
          {dateLabel(p.availableFrom)}
        </span>
      </div>
      <p className="candidate-work">
        <span>Most recent:</span> {p.workHistory[0]?.employer || "Fresher"}
        {p.workHistory[0] && ` · ${p.workHistory[0].propertyType}`}
      </p>
      <div className="candidate-card-footer">
        <div className="job-tags">
          <Badge tone={fail ? "sand" : "green"}>
            {fail ? "Screening needs review" : "Screening requirements met"}
          </Badge>
          <span className="fit-count">
            {fit.filter((f) => f.result === "pass").length}/{fit.length}{" "}
            criteria met
          </span>
        </div>
        <Link
          className="inline-link"
          href={`/employer/jobs/${a.jobId}/applicants/${a.id}`}
        >
          View profile <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
export function CandidateDetail({ jobId, id }: { jobId: string; id: string }) {
  return (
    <div className="container page">
      <Guard role="employer">
        <CandidateDetailView jobId={jobId} id={id} />
      </Guard>
    </div>
  );
}
function CandidateDetailView({ jobId, id }: { jobId: string; id: string }) {
  const { state, mutate, demo } = useWorkspace(),
    task = useTask();
  const [remote, setRemote] = useState<{
    application: Application | null;
    loading: boolean;
    error: string;
  }>({ application: null, loading: true, error: "" });
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    async function load() {
      try {
        const params = new URLSearchParams({
          jobId,
          applicationId: id,
          page: "1",
        });
        const response = await fetch(`/api/candidates?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not load application.");
        setRemote({
          application: data.applications[0] || null,
          loading: false,
          error: "",
        });
      } catch (e) {
        if (!controller.signal.aborted)
          setRemote({
            application: null,
            loading: false,
            error:
              e instanceof Error ? e.message : "Could not load application.",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [demo, jobId, id, state.applicationCounts]);
  const a = demo
    ? state.applications.find(
        (a) =>
          a.id === id &&
          a.jobId === jobId &&
          state.companies.some(
            (c) =>
              c.id === a.jobSnapshot.companyId && c.ownerId === state.userId,
          ),
      )
    : remote.application;
  if (!demo && remote.loading) return <Loading />;
  if (!demo && remote.error) return <Notice message={remote.error} error />;
  if (!a)
    return (
      <Empty
        title="Application unavailable"
        description="You can only view applicants to your own vacancies."
      />
    );
  const p = a.profile;
  const decide = (status: ApplicationStatus) =>
    void task.run(
      () =>
        mutate({ action: "application.status", payload: { id: a.id, status } }),
      `Application ${status}.`,
    );
  return (
    <>
      <Link className="back-link" href={`/employer/jobs/${jobId}/applicants`}>
        ← All applicants
      </Link>
      <PageHeading
        eyebrow="THE PROFILE SUBMITTED FOR THIS VACANCY"
        title={p.name}
        description={`${a.jobSnapshot.title} · Applied ${dateLabel(a.submittedAt)}`}
        action={<Status status={a.status} />}
      />
      <div className="detail-layout">
        <div>
          <section className="panel">
            <ProfileSummary profile={p} />
            <div className="candidate-extra">
              <p>
                <strong>Notice period:</strong>{" "}
                {p.noticeDays === 0 ? "Immediate" : `${p.noticeDays} days`}
              </p>
              <p>
                <strong>Relocation:</strong>{" "}
                {p.relocate
                  ? `Willing${p.preferredCities.length ? ` · ${p.preferredCities.join(", ")}` : " · Any city"}`
                  : "Not relocating"}
              </p>
              <p>
                <strong>Current salary:</strong>{" "}
                {p.currentSalary === null
                  ? "Not disclosed / not applicable"
                  : `${salary(p.currentSalary)} / month`}
              </p>
            </div>
          </section>
          <section className="panel">
            <h2>Work history</h2>
            {p.workHistory.length ? (
              p.workHistory.map((w) => (
                <div key={w.id} className="history-row">
                  <h3>{w.role}</h3>
                  <strong>
                    {w.employer} · {w.propertyType}
                  </strong>
                  <p>
                    {w.start} – {w.current ? "Present" : w.end}
                  </p>
                  {w.reason && (
                    <p className="muted">Reason for change: {w.reason}</p>
                  )}
                </div>
              ))
            ) : (
              <p>Starting their hospitality career.</p>
            )}
          </section>
          <section className="panel">
            <h2>Languages & certifications</h2>
            <div className="job-tags">
              {p.languages.map((l) => (
                <Badge key={l.name}>
                  {l.name} · {l.proficiency}
                </Badge>
              ))}
            </div>
            <h3>Certifications</h3>
            <p>
              {p.certifications.filter(Boolean).join(", ") ||
                "No certifications listed."}
            </p>
          </section>
          <section className="panel">
            <h2>Screening answers</h2>
            {a.jobSnapshot.questions.length ? (
              a.jobSnapshot.questions.map((q) => (
                <div className="answer-row" key={q.id}>
                  <h4>{q.label}</h4>
                  <p>{answerFor(a.answers, q.id) || "Not answered"}</p>
                  {q.dealBreaker && (
                    <Badge
                      tone={
                        a.screening.find((s) => s.questionId === q.id)?.passed
                          ? "green"
                          : "sand"
                      }
                    >
                      {a.screening.find((s) => s.questionId === q.id)?.passed
                        ? "Requirement met"
                        : "Requirement needs review"}
                    </Badge>
                  )}
                </div>
              ))
            ) : (
              <p>No screening questions were added to this vacancy.</p>
            )}
          </section>
        </div>
        <aside>
          <div className="panel candidate-decision">
            <h3>Your decision</h3>
            <p className="muted">
              The applicant can see status updates in their account.
            </p>
            <Notice message={task.message} error={task.error} />
            <Button
              disabled={!transitionAllowed(a.status, "shortlisted", "employer")}
              busy={task.busy}
              onClick={() => decide("shortlisted")}
            >
              Shortlist candidate
            </Button>
            <Button
              variant="secondary"
              disabled={!transitionAllowed(a.status, "hired", "employer")}
              busy={task.busy}
              onClick={() => decide("hired")}
            >
              Mark as hired
            </Button>
            <Button
              variant="danger"
              disabled={!transitionAllowed(a.status, "rejected", "employer")}
              busy={task.busy}
              onClick={() => decide("rejected")}
            >
              Reject application
            </Button>
            <hr />
            <h3>Get in touch</h3>
            {demo ? (
              <p className="muted">
                Contact actions are disabled for fictional demo candidates.
              </p>
            ) : (
              <>
                <a
                  className="button secondary"
                  href={`tel:${p.phone.replace(/[^+\d]/g, "")}`}
                >
                  <Phone size={16} />
                  Call candidate
                </a>
                {p.email && (
                  <a className="button secondary" href={`mailto:${p.email}`}>
                    <Mail size={16} />
                    Email candidate
                  </a>
                )}
              </>
            )}
          </div>
          <div className="panel">
            <h3>Fit at submission</h3>
            <div className="fit-list">
              {getFitIndicators(p, a.jobSnapshot, a.answers).map((f, i) => (
                <span key={i} className={f.result}>
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
              Transparent comparisons using self-reported information.
            </small>
          </div>
        </aside>
      </div>
    </>
  );
}
