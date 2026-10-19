"use client";
import { notFound } from "next/navigation";
import { Home, Jobs, JobDetail, CompanyPage } from "./pages/public";
import {
  ApplicantDashboard,
  Profile,
  Apply,
  Applications,
  Saved,
} from "./pages/applicant";
import {
  EmployerDashboard,
  EmployerJobs,
  CompanyEditor,
  JobEditor,
} from "./pages/employer";
import { Candidates, CandidateDetail } from "./pages/candidates";
import { Admin } from "./pages/admin";
import { Login } from "./pages/login";
export function RouteView({ path: p }: { path: string[] }) {
  if (!p.length) return <Home />;
  if (p.length === 1 && p[0] === "jobs") return <Jobs />;
  if (p.length === 2 && p[0] === "jobs") return <JobDetail id={p[1]} />;
  if (p.length === 3 && p[0] === "jobs" && p[2] === "apply")
    return <Apply key={p[1]} id={p[1]} />;
  if (p.length === 2 && p[0] === "companies") return <CompanyPage id={p[1]} />;
  if (p.length === 1 && p[0] === "login") return <Login />;
  if (p[0] === "applicant") {
    if (p.length === 1) return <ApplicantDashboard />;
    if (p.length === 2 && p[1] === "profile") return <Profile />;
    if (p.length === 2 && p[1] === "applications") return <Applications />;
    if (p.length === 2 && p[1] === "saved") return <Saved />;
  }
  if (p[0] === "employer") {
    if (p.length === 1) return <EmployerDashboard />;
    if (p.length === 2 && p[1] === "company") return <CompanyEditor />;
    if (p.length === 2 && p[1] === "jobs") return <EmployerJobs />;
    if (p.length === 3 && p[1] === "jobs" && p[2] === "new")
      return <JobEditor key="new" />;
    if (p.length === 4 && p[1] === "jobs" && p[3] === "edit")
      return <JobEditor key={p[2]} id={p[2]} />;
    if (p.length === 4 && p[1] === "jobs" && p[3] === "applicants")
      return <Candidates id={p[2]} />;
    if (p.length === 5 && p[1] === "jobs" && p[3] === "applicants")
      return <CandidateDetail jobId={p[2]} id={p[4]} />;
  }
  if (p.length === 1 && p[0] === "admin") return <Admin />;
  if (p.length === 2 && p[0] === "admin" && p[1] === "users")
    return <Admin manage />;
  notFound();
}
