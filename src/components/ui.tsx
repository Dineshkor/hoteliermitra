"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import type { Role } from "@/lib/types";
export function Button({
  children,
  variant = "primary",
  busy = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "cream" | "text" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${variant} ${props.className || ""}`}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function LinkButton({
  href,
  children,
  variant = "primary",
  arrow = false,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "cream" | "text" | "danger";
  arrow?: boolean;
}) {
  return (
    <Link className={`button ${variant}`} href={href}>
      {children}
      {arrow && <ArrowRight size={17} />}
    </Link>
  );
}
export function Field({
  label,
  optional = false,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {optional && <small>Optional</small>}
      </span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "sand" | "red";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Status({ status }: { status: string }) {
  return (
    <Badge
      tone={
        ["approved", "shortlisted", "hired"].includes(status)
          ? "green"
          : ["pending", "submitted"].includes(status)
            ? "sand"
            : ["rejected", "removed", "suspended"].includes(status)
              ? "red"
              : "neutral"
      }
    >
      {status === "approved"
        ? "Published / approved"
        : status.replace(/^./, (s) => s.toUpperCase())}
    </Badge>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <BriefcaseBusiness size={27} />
      </div>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={24} />
      <p>Loading your workspace…</p>
    </div>
  );
}
export function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const { state, demo, loading, switchRole } = useWorkspace();
  const pathname = usePathname();
  if (loading) return <Loading />;
  if (state.suspended)
    return (
      <Empty
        title="Account suspended"
        description={
          state.suspensionReason ||
          "Your account has been suspended by the platform owner. Please contact the site owner for a review."
        }
      />
    );
  if (state.role !== role)
    return (
      <Empty
        title={
          state.role ? `This is the ${role} workspace` : `Sign in to continue`
        }
        description={
          demo
            ? `You can explore this area using the ${role} demo account.`
            : "Use the account associated with this workspace."
        }
        action={
          demo ? (
            <Button onClick={() => switchRole(role)}>
              Explore {role} demo <ArrowRight size={16} />
            </Button>
          ) : (
            <LinkButton
              href={`/login?role=${role}&next=${encodeURIComponent(pathname)}`}
            >
              Sign in
            </LinkButton>
          )
        }
      />
    );
  return <>{children}</>;
}
export function Notice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  if (!message) return null;
  return (
    <div
      className={`notice ${error ? "error" : "success"}`}
      role={error ? "alert" : "status"}
    >
      {!error && <ShieldCheck size={18} />}
      <span>{message}</span>
    </div>
  );
}
export function useTask() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  async function run(fn: () => Promise<void>, success = "Saved successfully.") {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setError(false);
      setMessage(success);
      return true;
    } catch (e) {
      setError(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, error, run };
}
