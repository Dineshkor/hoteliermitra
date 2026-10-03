"use client";
import { useState } from "react";
import {
  ShieldCheck,
  Building2,
  BriefcaseBusiness,
  Check,
  X,
  Eye,
  UserX,
} from "lucide-react";
import { useWorkspace } from "../workspace-provider";
import {
  Badge,
  Button,
  Empty,
  Field,
  Guard,
  Notice,
  PageHeading,
  Status,
  useTask,
} from "../ui";
import { CompanyMark } from "../job-card";
import { dateLabel, salary } from "@/lib/taxonomy";
import type { Company, Job } from "@/lib/types";
export function Admin({ manage = false }: { manage?: boolean }) {
  return (
    <div className="container page">
      <Guard role="admin">
        <AdminView manage={manage} />
      </Guard>
    </div>
  );
}
function AdminView({ manage }: { manage: boolean }) {
  const { state } = useWorkspace();
  const [tab, setTab] = useState("companies");
  const companies = state.companies.filter(
      (c) => manage || c.status === "pending",
    ),
    jobs = state.jobs.filter(
      (j) =>
        manage ||
        j.status === "pending" ||
        j.pendingRevision?.status === "pending",
    );
  return (
    <>
      <PageHeading
        eyebrow="KEEP HOSPITALITY HIRING TRUSTWORTHY"
        title={manage ? "Manage employers & listings." : "The review queue."}
        description="Review real business details and clear vacancies before they reach applicants."
      />
      <div className="stat-grid three">
        <div className="stat-card">
          <Building2 size={22} />
          <strong>
            {state.companies.filter((c) => c.status === "pending").length}
          </strong>
          <span>Employers awaiting review</span>
        </div>
        <div className="stat-card">
          <BriefcaseBusiness size={22} />
          <strong>
            {
              state.jobs.filter(
                (j) =>
                  j.status === "pending" ||
                  j.pendingRevision?.status === "pending",
              ).length
            }
          </strong>
          <span>Vacancies awaiting review</span>
        </div>
        <div className="stat-card">
          <ShieldCheck size={22} />
          <strong>{state.moderation.length}</strong>
          <span>Moderation decisions</span>
        </div>
      </div>
      <div className="tabs">
        <button
          onClick={() => setTab("companies")}
          className={tab === "companies" ? "selected" : ""}
        >
          Employers <span>{companies.length}</span>
        </button>
        <button
          onClick={() => setTab("jobs")}
          className={tab === "jobs" ? "selected" : ""}
        >
          Vacancies <span>{jobs.length}</span>
        </button>
        <button
          onClick={() => setTab("history")}
          className={tab === "history" ? "selected" : ""}
        >
          Decision history
        </button>
        {manage && (
          <button
            onClick={() => setTab("accounts")}
            className={tab === "accounts" ? "selected" : ""}
          >
            User accounts
          </button>
        )}
      </div>
      {tab === "companies" ? (
        companies.length ? (
          <div className="review-grid">
            {companies.map((c) => (
              <CompanyReview key={c.id} company={c} manage={manage} />
            ))}
          </div>
        ) : (
          <Empty
            title="Employer reviews are up to date"
            description="New employer submissions will appear here."
          />
        )
      ) : tab === "jobs" ? (
        jobs.length ? (
          <div className="review-grid">
            {jobs.map((j) => (
              <JobReview key={j.id} job={j} manage={manage} />
            ))}
          </div>
        ) : (
          <Empty
            title="Vacancy reviews are up to date"
            description="New job submissions and revisions will appear here."
          />
        )
      ) : tab === "accounts" ? (
        <div className="review-grid">
          {(state.accounts || []).map((account) => (
            <AccountReview key={account.id} account={account} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <h2>Moderation history</h2>
          {state.moderation.length ? (
            state.moderation.map((e) => (
              <div className="history-row" key={e.id}>
                <Status status={e.action} />
                <p>
                  {state.companies.find((c) => c.id === e.targetId)?.name ||
                    state.jobs.find((j) => j.id === e.targetId)?.title ||
                    e.targetId}
                </p>
                <p className="muted">
                  {e.reason || "Approved"} · {dateLabel(e.at)}
                </p>
              </div>
            ))
          ) : (
            <p className="muted">No moderation actions yet.</p>
          )}
        </div>
      )}
    </>
  );
}
function AccountReview({
  account,
}: {
  account: { id: string; role: string; name: string; suspended: boolean };
}) {
  const { mutate } = useWorkspace(),
    task = useTask();
  const [reason, setReason] = useState("");
  return (
    <article className="panel review-card">
      <div className="entry-heading">
        <div>
          <h3>{account.name || account.id}</h3>
          <p className="muted">{account.role} account</p>
        </div>
        <Badge tone={account.suspended ? "red" : "green"}>
          {account.suspended ? "Suspended" : "Active"}
        </Badge>
      </div>
      {account.role !== "admin" && !account.suspended && (
        <>
          <Field label="Suspension reason">
            <textarea
              rows={2}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Notice message={task.message} error={task.error} />
          <Button
            busy={task.busy}
            variant="danger"
            onClick={() =>
              void task.run(async () => {
                if (!reason.trim())
                  throw new Error("Add a reason for this suspension.");
                await mutate({
                  action: "account.suspend",
                  payload: { id: account.id, reason },
                });
              }, "Account suspended.")
            }
          >
            <UserX size={16} />
            Suspend account
          </Button>
        </>
      )}
    </article>
  );
}
function CompanyReview({
  company: c,
  manage,
}: {
  company: Company;
  manage: boolean;
}) {
  const { mutate } = useWorkspace(),
    task = useTask();
  const [reason, setReason] = useState("");
  const review = (status: "approved" | "rejected" | "suspended") =>
    void task.run(async () => {
      if (status !== "approved" && !reason.trim())
        throw new Error(
          "Add a reason so the employer understands your decision.",
        );
      await mutate({
        action: "company.review",
        payload: { id: c.id, status, reason },
      });
    }, `Employer ${status}.`);
  return (
    <article className="panel review-card">
      <div className="job-card-top">
        <CompanyMark company={c} />
        <div>
          <h3>{c.name}</h3>
          <p className="muted">
            {c.type} · {c.city}
          </p>
        </div>
        <Status status={c.status} />
      </div>
      <p className="prose-lines">{c.description}</p>
      <dl className="review-facts">
        <div>
          <dt>Address</dt>
          <dd>{c.address}</dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>
            {c.phone} · {c.email}
          </dd>
        </div>
        {c.website && (
          <div>
            <dt>Website</dt>
            <dd>{c.website}</dd>
          </div>
        )}
      </dl>
      {c.reviewReason && (
        <p className="review-reason">Last decision: {c.reviewReason}</p>
      )}
      <Field
        label="Reason / review note"
        optional
        hint="Required for rejection or suspension."
      >
        <textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
        />
      </Field>
      <Notice message={task.message} error={task.error} />
      <div className="review-actions">
        {["pending", "rejected", "suspended"].includes(c.status) && (
          <Button busy={task.busy} onClick={() => review("approved")}>
            <Check size={16} />
            Approve employer
          </Button>
        )}
        {c.status === "pending" && (
          <Button
            variant="danger"
            busy={task.busy}
            onClick={() => review("rejected")}
          >
            <X size={16} />
            Reject
          </Button>
        )}
        {manage && c.status !== "suspended" && (
          <Button
            variant="danger"
            busy={task.busy}
            onClick={() => review("suspended")}
          >
            <UserX size={16} />
            Suspend
          </Button>
        )}
      </div>
    </article>
  );
}
function JobReview({ job: base, manage }: { job: Job; manage: boolean }) {
  const { state, mutate } = useWorkspace(),
    task = useTask();
  const [reason, setReason] = useState(""),
    [open, setOpen] = useState(false);
  const job = base.pendingRevision || base,
    company = state.companies.find((c) => c.id === job.companyId);
  const review = (status: "approved" | "rejected" | "removed") =>
    void task.run(async () => {
      if (status !== "approved" && !reason.trim())
        throw new Error("Add a reason for this decision.");
      await mutate({
        action: "job.review",
        payload: { id: job.id, status, reason },
      });
    }, `Vacancy ${status}.`);
  return (
    <article className="panel review-card">
      <div className="entry-heading">
        <div>
          <p className="eyebrow">{company?.name}</p>
          <h3>{job.title || "Untitled vacancy"}</h3>
        </div>
        <Status status={job.status} />
      </div>
      {base.pendingRevision && (
        <Badge tone="sand">Revision · version {job.version}</Badge>
      )}
      <p className="muted">
        {job.role} · {job.city}, {job.locality} · {job.propertyType}
      </p>
      <div className="review-facts compact">
        <span>
          {salary(job.salaryMin)}–{salary(job.salaryMax)} / month
        </span>
        <span>
          {job.experienceMin}+ years · {job.openings} openings · {job.shift}
        </span>
        <span>
          Stay: {job.accommodation ? "Provided" : "Not provided"} · Meals:{" "}
          {job.meals ? "Provided" : "Not provided"}
        </span>
      </div>
      {company?.status !== "approved" && (
        <Notice
          message="The employer must be approved before this vacancy can go live."
          error
        />
      )}
      <button className="inline-link" onClick={() => setOpen(!open)}>
        <Eye size={15} />
        {open ? "Hide full details" : "Review full details"}
      </button>
      {open && (
        <div className="review-job-detail">
          <p className="prose-lines">{job.description}</p>
          <dl className="review-facts">
            <div>
              <dt>Department</dt>
              <dd>{job.department}</dd>
            </div>
            <div>
              <dt>Employment type</dt>
              <dd>{job.employmentType}</dd>
            </div>
            <div>
              <dt>Experience preference</dt>
              <dd>
                {job.experienceMin}
                {job.experienceMax === null
                  ? "+"
                  : `–${job.experienceMax}`}{" "}
                years
              </dd>
            </div>
            <div>
              <dt>Skills</dt>
              <dd>{job.skills.join(", ") || "None specified"}</dd>
            </div>
            <div>
              <dt>Languages</dt>
              <dd>{job.languages.join(", ") || "None specified"}</dd>
            </div>
            <div>
              <dt>Join by</dt>
              <dd>{dateLabel(job.joiningBy)}</dd>
            </div>
          </dl>
          <h4>Screening questions</h4>
          {job.questions.length ? (
            job.questions.map((q) => (
              <p key={q.id}>
                <strong>{q.label}</strong>
                <br />
                {q.type} · {q.required ? "Required" : "Optional"}
                {q.dealBreaker &&
                  ` · Deal-breaker: ${q.comparison} ${q.expected}`}
                {q.type === "choice" && (
                  <>
                    <br />
                    Options: {q.options.join(" · ")}
                  </>
                )}
              </p>
            ))
          ) : (
            <p>None added.</p>
          )}
        </div>
      )}
      <Field
        label="Review reason"
        optional
        hint="Required for rejection or removal."
      >
        <textarea
          rows={2}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <Notice message={task.message} error={task.error} />
      <div className="review-actions">
        {job.status === "pending" &&
          base.status !== "closed" &&
          base.status !== "removed" && (
            <Button
              busy={task.busy}
              disabled={company?.status !== "approved"}
              onClick={() => review("approved")}
            >
              <Check size={16} />
              Approve vacancy
            </Button>
          )}
        {job.status === "pending" && (
          <Button
            busy={task.busy}
            variant="danger"
            onClick={() => review("rejected")}
          >
            Reject
          </Button>
        )}
        {manage && base.status !== "removed" && (
          <Button
            busy={task.busy}
            variant="danger"
            onClick={() => review("removed")}
          >
            Remove listing
          </Button>
        )}
      </div>
    </article>
  );
}
