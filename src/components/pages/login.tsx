"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChefHat, Building2, ShieldCheck } from "lucide-react";
import { useWorkspace } from "../workspace-provider";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Notice, useTask } from "../ui";
import type { Role } from "@/lib/types";
export function Login() {
  const { demo, switchRole, reload } = useWorkspace();
  const params = useSearchParams(),
    router = useRouter();
  const [role, setRole] = useState<Role>(
      params.get("role") === "admin"
        ? "admin"
        : params.get("role") === "employer"
          ? "employer"
          : "applicant",
    ),
    [contact, setContact] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false);
  const task = useTask();
  const destination =
    role === "employer"
      ? "/employer"
      : role === "admin"
        ? "/admin"
        : params.get("next")?.startsWith("/jobs/")
          ? params.get("next")!
          : "/applicant";
  async function requestCode() {
    await task.run(
      async () => {
        const supabase = createClient();
        const result =
          role === "applicant"
            ? await supabase.auth.signInWithOtp({
                phone: contact.startsWith("+")
                  ? contact
                  : `+91${contact.replace(/\D/g, "")}`,
                options: { shouldCreateUser: true, data: { role } },
              })
            : await supabase.auth.signInWithOtp({
                email: contact,
                options: {
                  shouldCreateUser: role !== "admin",
                  data: role === "admin" ? undefined : { role },
                  emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(destination)}`,
                },
              });
        if (result.error) throw new Error(result.error.message);
        setSent(true);
      },
      role === "applicant"
        ? "A verification code has been sent to your phone."
        : "Check your email for the verification code or sign-in link.",
    );
  }
  async function verify() {
    await task.run(async () => {
      const supabase = createClient();
      const result =
        role === "applicant"
          ? await supabase.auth.verifyOtp({
              phone: contact.startsWith("+")
                ? contact
                : `+91${contact.replace(/\D/g, "")}`,
              token: code,
              type: "sms",
            })
          : await supabase.auth.verifyOtp({
              email: contact,
              token: code,
              type: "email",
            });
      if (result.error) throw new Error(result.error.message);
      await reload();
      router.push(destination);
    }, "You’re signed in.");
  }
  return (
    <div className="container auth-page">
      <div className="auth-story">
        <p className="eyebrow">GOOD PEOPLE. GREAT HOSPITALITY.</p>
        <h1>
          {role === "employer" ? (
            <>
              Your team’s
              <br />
              next chapter
              <br />
              <em>starts here.</em>
            </>
          ) : (
            <>
              Your experience
              <br />
              deserves the
              <br />
              <em>right opportunity.</em>
            </>
          )}
        </h1>
        <p>
          {role === "employer"
            ? "Spend less time sorting applications. See the experience, expectations, and availability that matter to your property."
            : "Create one profile, apply to hospitality roles across India, and follow your progress."}
        </p>
        <span className="auth-assurance">
          <ShieldCheck size={21} />
          Made for hospitality careers.
        </span>
      </div>
      <div className="panel auth-form">
        <span className="eyebrow">
          {role === "admin" ? "PLATFORM ADMIN" : "WELCOME TO HOSPITALITY HIRE"}
        </span>
        <h2>{sent ? "Check your messages." : "Let’s get you started."}</h2>
        {role !== "admin" && !sent && (
          <div className="role-options">
            <button
              className={role === "applicant" ? "selected" : ""}
              disabled={task.busy}
              onClick={() => {
                setRole("applicant");
                setContact("");
              }}
            >
              <ChefHat size={23} />
              I’m looking for a job
            </button>
            <button
              className={role === "employer" ? "selected" : ""}
              disabled={task.busy}
              onClick={() => {
                setRole("employer");
                setContact("");
              }}
            >
              <Building2 size={23} />
              I’m hiring staff
            </button>
          </div>
        )}
        {params.get("error") === "confirmation" && (
          <Notice
            message="The sign-in link could not be verified. Request a fresh code below."
            error
          />
        )}
        {demo ? (
          <>
            <Notice message="Local demo: no account is created and no OTP is sent. Explore using a fictional profile." />
            <Button
              onClick={() => {
                switchRole(role);
                router.push(destination);
              }}
            >
              Explore {role} demo <ArrowRight size={17} />
            </Button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void (sent ? verify() : requestCode());
            }}
          >
            {sent ? (
              <>
                <p className="muted">Enter the code sent to {contact}.</p>
                <Field label="Verification code">
                  <input
                    value={code}
                    disabled={task.busy}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6,8}"
                    maxLength={8}
                    autoFocus
                  />
                </Field>
                <Button type="submit" busy={task.busy}>
                  Verify & continue <ArrowRight size={17} />
                </Button>
                <Button
                  type="button"
                  variant="text"
                  disabled={task.busy}
                  onClick={() => {
                    setSent(false);
                    setCode("");
                  }}
                >
                  Use a different{" "}
                  {role === "applicant" ? "phone number" : "email"}
                </Button>
              </>
            ) : (
              <>
                <p className="muted">
                  {role === "admin"
                    ? "Sign in with your privately provisioned admin account."
                    : "Sign in or create your account with a verification code."}
                </p>
                <Field
                  label={
                    role === "applicant" ? "Mobile number" : "Email address"
                  }
                  hint={
                    role === "applicant"
                      ? "Indian mobile number, with or without +91."
                      : undefined
                  }
                >
                  <input
                    value={contact}
                    disabled={task.busy}
                    onChange={(e) => setContact(e.target.value)}
                    type={role === "applicant" ? "tel" : "email"}
                    autoComplete={role === "applicant" ? "tel" : "email"}
                    required
                    placeholder={
                      role === "applicant"
                        ? "9876543210"
                        : "you@yourproperty.com"
                    }
                  />
                </Field>
                <Button type="submit" busy={task.busy}>
                  Send verification code <ArrowRight size={17} />
                </Button>
              </>
            )}
            <Notice message={task.message} error={task.error} />
          </form>
        )}
        <p className="auth-footnote">
          {role === "employer"
            ? "Employer accounts and vacancies are reviewed before publication."
            : role === "admin"
              ? "Admin access cannot be created through this page."
              : "Your profile is shared only with employers you apply to."}
        </p>
      </div>
    </div>
  );
}
