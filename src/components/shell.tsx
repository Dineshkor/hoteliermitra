"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChefHat,
  Menu,
  UserRound,
  ClipboardList,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { createClient } from "@/lib/supabase/client";
import { Notice, Button, useTask } from "./ui";
import type { ReactNode } from "react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Hospitality Hire home">
      <span className="brand-symbol">
        <ChefHat size={24} strokeWidth={1.6} />
      </span>
      <span>
        hospitality<span className="brand-accent">hire</span>
        <span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const { state, demo, error, reload, reset, switchRole } = useWorkspace();
  const path = usePathname();
  const router = useRouter();
  const role = state.role;
  const signoutTask = useTask();
  const links =
    role === "employer"
      ? [
          ["/employer", "Overview"],
          ["/employer/jobs", "My vacancies"],
          ["/employer/company", "Company profile"],
        ]
      : role === "admin"
        ? [
            ["/admin", "Review queue"],
            ["/admin/users", "Manage accounts"],
          ]
        : [
            ["/jobs", "Find a job"],
            ["/applicant/applications", "My applications"],
          ];
  async function signout() {
    await signoutTask.run(async () => {
      const { error } = await createClient().auth.signOut();
      if (error) throw new Error(error.message);
      await reload();
      router.push("/");
    }, "");
  }
  return (
    <>
      {demo && (
        <div className="demo-bar">
          <div className="container demo-inner">
            <span>
              <span className="dot" /> Local demo{" "}
              <span className="demo-note">· fictional jobs and people</span>
            </span>
            <div>
              <label>
                Preview as{" "}
                <select
                  aria-label="Preview as"
                  value={role || "applicant"}
                  onChange={(e) => {
                    const r = e.target.value as
                      "applicant" | "employer" | "admin";
                    switchRole(r);
                    router.push(r === "applicant" ? "/jobs" : `/${r}`);
                  }}
                >
                  <option value="applicant">Applicant</option>
                  <option value="employer">Employer</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <button className="text-button" onClick={reset}>
                Reset demo
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={path === href ? "active" : ""}
              >
                {label}
              </Link>
            ))}
            {!role && <Link href="/#how-it-works">How it works</Link>}
          </nav>
          <div className="header-actions">
            {role === "applicant" ? (
              <>
                <Link href="/applicant/profile" className="profile-link">
                  <UserRound size={17} />
                  My profile
                </Link>
                {!demo && (
                  <button
                    className="text-button"
                    disabled={signoutTask.busy}
                    onClick={() => void signout()}
                  >
                    Sign out
                  </button>
                )}
              </>
            ) : role ? (
              <>
                <span className="role-label">{role} workspace</span>
                {!demo && (
                  <button
                    className="text-button"
                    disabled={signoutTask.busy}
                    onClick={() => void signout()}
                  >
                    Sign out
                  </button>
                )}
              </>
            ) : (
              <Link href="/login" className="text-button">
                Sign in
              </Link>
            )}
            {(!role || role === "applicant") && (
              <Link
                href={demo ? "/employer" : "/login?role=employer"}
                className="button primary small"
              >
                For employers <ArrowUpRight size={15} />
              </Link>
            )}
            <details className="mobile-menu">
              <summary aria-label="Open navigation">
                <Menu size={23} />
              </summary>
              <nav>
                {links.map(([href, label]) => (
                  <Link key={href} href={href}>
                    {label}
                  </Link>
                ))}
                <Link href="/applicant/profile">My profile</Link>
                <Link href="/employer">Employer workspace</Link>
                {!demo && role && (
                  <button
                    disabled={signoutTask.busy}
                    onClick={() => void signout()}
                  >
                    Sign out
                  </button>
                )}
              </nav>
            </details>
          </div>
        </div>
      </header>
      {signoutTask.error && (
        <div className="container">
          <Notice message={signoutTask.message} error />
        </div>
      )}
      {error && (
        <div className="container">
          <Notice message={error} error />
          <Button variant="secondary" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      )}
      <main id="main-content">{children}</main>
      <footer className="site-footer">
        <div className="container footer-main">
          <div>
            <Brand />
            <p>Good people. Great hospitality.</p>
            <small>Built for hospitality careers across India.</small>
          </div>
          <div className="footer-links">
            <Link href="/jobs">Find your next role</Link>
            <Link href="/employer">Build your team</Link>
            <Link href="/#how-it-works">How it works</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Hospitality Hire</span>
          <span>Hotels · Restaurants · Resorts · Cafes · Catering</span>
        </div>
      </footer>
      {role === "applicant" && (
        <nav className="mobile-bottom" aria-label="Applicant navigation">
          <Link href="/jobs">
            <BriefcaseBusiness size={20} />
            Jobs
          </Link>
          <Link href="/applicant/applications">
            <ClipboardList size={20} />
            Applications
          </Link>
          <Link href="/applicant/profile">
            <UserRound size={20} />
            Profile
          </Link>
        </nav>
      )}
    </>
  );
}
