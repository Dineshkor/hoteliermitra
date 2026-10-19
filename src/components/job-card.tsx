"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BedDouble,
  Bookmark,
  MapPin,
  Utensils,
  Clock3,
  BriefcaseBusiness,
  CheckCircle2,
} from "lucide-react";
import type { Company, Job } from "@/lib/types";
import { salary } from "@/lib/taxonomy";
import { Badge } from "./ui";
import { useWorkspace } from "./workspace-provider";
import { useTask } from "./ui";
export function CompanyMark({ company }: { company?: Company }) {
  return (
    <span className={`company-mark ${company?.color || "sand"}`}>
      {company?.initials || "HH"}
    </span>
  );
}
export function SaveJobButton({ jobId }: { jobId: string }) {
  const { state, mutate } = useWorkspace();
  const pathname = usePathname();
  const task = useTask();
  const role = state.role;
  const saved = state.savedJobIds.includes(jobId);
  if (role === null)
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className="icon-link"
        aria-label="Sign in to save this job"
      >
        <Bookmark size={19} />
      </Link>
    );
  if (role !== "applicant") return null;
  return (
    <button
      type="button"
      className={`icon-link ${saved ? "saved" : ""}`}
      aria-pressed={saved}
      aria-label={saved ? "Saved job" : "Save job"}
      disabled={task.busy}
      onClick={() =>
        void task.run(
          () =>
            mutate({
              action: "savedJob.toggle",
              payload: { jobId, saved: !saved },
            }),
          saved ? "Removed from saved jobs." : "Job saved.",
        )
      }
    >
      <Bookmark size={19} fill={saved ? "currentColor" : "none"} />
      {task.message && (
        <span className="sr-only" role="status">
          {task.message}
        </span>
      )}
    </button>
  );
}
export function JobCard({ job, company }: { job: Job; company?: Company }) {
  return (
    <article className="job-card">
      <div className="job-card-top">
        <CompanyMark company={company} />
        <div>
          <Link className="company-name" href={`/companies/${job.companyId}`}>
            {company?.name || "Hospitality employer"}
          </Link>
          <span className="property-line">
            {job.propertyType}
            {company?.status === "approved" && (
              <span title="Employer approved">
                <CheckCircle2 size={13} />
              </span>
            )}
          </span>
        </div>
        <SaveJobButton jobId={job.id} />
        <Link
          href={`/jobs/${job.id}`}
          className="icon-link"
          aria-label={`View ${job.title}`}
        >
          <ArrowUpRight size={21} />
        </Link>
      </div>
      <Link href={`/jobs/${job.id}`} className="job-title">
        {job.title}
      </Link>
      <div className="job-meta">
        <span>
          <MapPin size={14} />
          {job.city}, {job.locality}
        </span>
        <span>
          <BriefcaseBusiness size={14} />
          {job.experienceMin === 0
            ? "Freshers welcome"
            : `${job.experienceMin}${job.experienceMax ? `–${job.experienceMax}` : "+"} years`}
        </span>
      </div>
      <div className="job-tags">
        <Badge>{job.employmentType}</Badge>
        <Badge>
          {job.department === "Food & Beverage Service"
            ? "F&B Service"
            : job.department}
        </Badge>
        {job.accommodation && (
          <span className="benefit">
            <BedDouble size={13} />
            Stay provided
          </span>
        )}
        {job.meals && (
          <span className="benefit">
            <Utensils size={13} />
            Meals
          </span>
        )}
      </div>
      <div className="job-card-bottom">
        <span>
          <strong>
            {salary(job.salaryMin)} – {salary(job.salaryMax)}
          </strong>
          <small>/ month</small>
        </span>
        <span className="job-date">
          <Clock3 size={12} />
          {new Date(job.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>
    </article>
  );
}
