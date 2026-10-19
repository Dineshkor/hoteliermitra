"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  MapPin,
  ChefHat,
  ConciergeBell,
  BedDouble,
  UtensilsCrossed,
  Wrench,
  Building2,
  Check,
  SlidersHorizontal,
  ShieldCheck,
  Clock3,
  BriefcaseBusiness,
  UsersRound,
  Utensils,
  CalendarDays,
  HeartHandshake,
} from "lucide-react";
import { useWorkspace } from "../workspace-provider";
import { filtersFromSearchParams, jobMatchesFilters, publicJobs } from "@/lib/domain";
import { SaveSearchBar } from "../save-search";
import { CompanyMark, JobCard, SaveJobButton } from "../job-card";
import {
  departments,
  propertyTypes,
  cities,
  salary,
  dateLabel,
} from "@/lib/taxonomy";
import { Badge, Empty, Field, LinkButton, Loading, PageHeading } from "../ui";
const departmentIcons = [
  ChefHat,
  UtensilsCrossed,
  ConciergeBell,
  BedDouble,
  Wrench,
  Building2,
];
export function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter(),
    params = useSearchParams();
  return (
    <form
      key={JSON.stringify([params.get("q"), params.get("city")])}
      className={`search-bar ${compact ? "compact" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const query = new URLSearchParams();
        if (form.get("q")) query.set("q", String(form.get("q")));
        if (form.get("city")) query.set("city", String(form.get("city")));
        router.push(`/jobs?${query}`);
      }}
    >
      <label>
        <Search size={20} />
        <span className="sr-only">Job title or keyword</span>
        <input
          name="q"
          placeholder="Job title, role or keyword"
          defaultValue={params.get("q") || ""}
        />
      </label>
      <label>
        <MapPin size={20} />
        <span className="sr-only">City</span>
        <input
          name="city"
          placeholder="City or location"
          list="search-cities"
          defaultValue={params.get("city") || ""}
        />
      </label>
      <datalist id="search-cities">
        {cities.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <button type="submit" className="button primary">
        Find jobs <ArrowRight size={17} />
      </button>
    </form>
  );
}
export function Home() {
  const { state, loading } = useWorkspace();
  const jobs = publicJobs(state.jobs, state.companies);
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="hero-eyebrow">
              <span className="dot" />
              EXCLUSIVELY FOR HOSPITALITY
            </span>
            <h1>
              Great hospitality
              <br />
              starts with
              <br />
              <em>the right people.</em>
            </h1>
            <p>
              From the first welcome to the last course. Find your place—or your
              people—in India’s hospitality industry.
            </p>
            <div className="hero-actions">
              <LinkButton href="/jobs" arrow>
                Find your next role
              </LinkButton>
              <LinkButton href="/employer" variant="outline">
                Hire the right people <ArrowUpRight size={17} />
              </LinkButton>
            </div>
            <div className="hero-footnote">
              <ShieldCheck size={17} />
              <span>
                Reviewed employers. Clear salaries. One reusable profile.
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <Image
              src="/restaurant.jpg"
              alt="A warmly lit restaurant dining room prepared for guests"
              fill
              priority
              sizes="(max-width: 760px) 100vw, 45vw"
            />
            <div className="image-shade" />
            <span className="image-label">
              THE PEOPLE BEHIND EVERY EXPERIENCE
            </span>
            <div className="hero-image-caption">
              <span>
                Good people.
                <br />
                <em>Great hospitality.</em>
              </span>
              <span className="hero-caption-arrow">
                <ArrowUpRight size={30} />
              </span>
            </div>
            <div className="hero-photo-tag">
              <HeartHandshake size={19} />
              <span>
                Made for hospitality.<small>Built around you.</small>
              </span>
            </div>
          </div>
        </div>
        <div className="container hero-search">
          <SearchBar />
          <div className="popular">
            <span>Popular searches:</span>
            <Link href="/jobs?q=chef">Chef</Link>
            <Link href="/jobs?department=Front+Office">Front office</Link>
            <Link href="/jobs?department=Housekeeping">Housekeeping</Link>
            <Link href="/jobs?city=Goa">Jobs in Goa</Link>
          </div>
        </div>
      </section>
      <section className="container section departments-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">EVERY DEPARTMENT. ONE INDUSTRY.</p>
            <h2>Where do you belong?</h2>
          </div>
          <Link className="inline-link" href="/jobs">
            Explore all roles <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="department-grid">
          {Object.keys(departments).map((d, i) => {
            const Icon = departmentIcons[i];
            return (
              <Link
                className="department-card"
                key={d}
                href={`/jobs?department=${encodeURIComponent(d)}`}
              >
                <Icon size={26} strokeWidth={1.4} />
                <strong>
                  {d === "Food & Beverage Service" ? "F&B Service" : d}
                </strong>
                <span>
                  Explore roles <ArrowUpRight size={13} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="container section featured-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">YOUR NEXT CHAPTER</p>
            <h2>A role that feels right.</h2>
            <p className="muted">
              Clear expectations. Real opportunities to grow.
            </p>
          </div>
          <Link className="inline-link" href="/jobs">
            View all jobs <ArrowRight size={17} />
          </Link>
        </div>
        {loading ? (
          <Loading />
        ) : jobs.length ? (
          <div className="job-grid">
            {jobs.slice(0, 6).map((j) => (
              <JobCard
                key={j.id}
                job={j}
                company={state.companies.find((c) => c.id === j.companyId)}
              />
            ))}
          </div>
        ) : (
          <Empty
            title="The first opportunities are on their way"
            description="Employers can submit a vacancy for review. Approved jobs will appear here."
            action={<LinkButton href="/employer">Post a vacancy</LinkButton>}
          />
        )}
      </section>
      <section className="how-section" id="how-it-works">
        <div className="container how-grid">
          <div>
            <p className="eyebrow">LESS SORTING. BETTER CONVERSATIONS.</p>
            <h2>
              Hospitality hiring,
              <br />
              <em>with the details that matter.</em>
            </h2>
            <p className="muted">
              Experience means more than a job title. Share the kitchens,
              properties, and teams you’ve worked with—so the right employer can
              find the right fit.
            </p>
            <div className="how-points">
              <div>
                <span>01</span>
                <div>
                  <h3>A profile that does the work</h3>
                  <p>
                    Your experience, skills, salary, and availability. Fill it
                    once, use it for every application.
                  </p>
                </div>
              </div>
              <div>
                <span>02</span>
                <div>
                  <h3>Apply in a few simple steps</h3>
                  <p>
                    Answer a handful of role-specific questions. Keep track of
                    every application.
                  </p>
                </div>
              </div>
              <div>
                <span>03</span>
                <div>
                  <h3>A clearer picture for employers</h3>
                  <p>
                    Filter by the details that matter. Spend your time talking
                    to people who fit.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="how-illustration">
            <span className="illustration-note">
              WHAT A STRUCTURED PROFILE CAN SHOW
            </span>
            <div className="sample-profile">
              <div className="sample-profile-top">
                <span className="avatar large">AS</span>
                <div>
                  <h3>Sample candidate</h3>
                  <p>Commis Chef · Kitchen</p>
                </div>
                <ShieldCheck size={25} />
              </div>
              <div className="sample-stats">
                <div>
                  <strong>2 years</strong>
                  <span>Experience</span>
                </div>
                <div>
                  <strong>₹26,000</strong>
                  <span>Expected / month</span>
                </div>
                <div>
                  <strong>15 days</strong>
                  <span>Notice period</span>
                </div>
              </div>
              <div className="sample-fit">
                <span>
                  <Check size={16} /> Meets minimum experience
                </span>
                <span>
                  <Check size={16} /> Salary within range
                </span>
                <span>
                  <Check size={16} /> Willing to relocate
                </span>
              </div>
              <div className="sample-bottom">
                The details you need. Before the first call.
                <ArrowUpRight size={17} />
              </div>
            </div>
            <div className="how-caption">
              <span className="star">✳</span> Better information makes better
              hiring possible.
            </div>
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="employer-cta">
          <div>
            <p className="eyebrow">FOR THE PEOPLE BUILDING GREAT TEAMS</p>
            <h2>
              Your next great hire
              <br />
              could be right here.
            </h2>
            <p>
              Post a clear vacancy. Get structured applications.
              <br />
              Find people who fit your property.
            </p>
          </div>
          <LinkButton href="/employer" variant="cream" arrow>
            Start hiring
          </LinkButton>
          <ChefHat className="cta-decoration" size={150} strokeWidth={0.65} />
        </div>
      </section>
    </>
  );
}
export function Jobs() {
  const { state, loading } = useWorkspace();
  const params = useSearchParams(),
    router = useRouter();
  const filters = filtersFromSearchParams(params),
    city = filters.city,
    department = filters.department,
    type = filters.propertyType;
  const jobs = publicJobs(state.jobs, state.companies)
    .filter((j) =>
      jobMatchesFilters(
        j,
        state.companies.find((c) => c.id === j.companyId)?.name,
        filters,
      ),
    )
    .sort((a, b) =>
      filters.sort === "salary"
        ? b.salaryMax - a.salaryMax
        : b.createdAt.localeCompare(a.createdAt),
    );
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/jobs?${next}`, { scroll: false });
  };
  return (
    <div className="container page">
      <PageHeading
        eyebrow="HOSPITALITY CAREERS, ACROSS INDIA"
        title="Find your next chapter."
        description="A better fit starts with clear expectations."
      />
      <SearchBar compact />
      <SaveSearchBar filters={filters} />
      <div className="search-layout">
        <aside className="filter-panel">
          <div className="filter-heading">
            <h3>
              <SlidersHorizontal size={17} /> Refine your search
            </h3>
            <Link href="/jobs">Clear</Link>
          </div>
          <Field label="Department">
            <select
              value={department}
              onChange={(e) => update("department", e.target.value)}
            >
              <option value="">All departments</option>
              {Object.keys(departments).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Property type">
            <select
              value={type}
              onChange={(e) => update("type", e.target.value)}
            >
              <option value="">Any property</option>
              {propertyTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Monthly salary from">
            <select
              value={params.get("salary") || ""}
              onChange={(e) => update("salary", e.target.value)}
            >
              <option value="">Any salary</option>
              {[15000, 20000, 25000, 30000, 40000, 50000].map((s) => (
                <option key={s} value={s}>
                  {salary(s)}
                </option>
              ))}
            </select>
          </Field>
          <div className="filter-checks">
            <label>
              <input
                type="checkbox"
                checked={params.get("stay") === "yes"}
                onChange={(e) => update("stay", e.target.checked ? "yes" : "")}
              />{" "}
              Accommodation provided
            </label>
            <label>
              <input
                type="checkbox"
                checked={params.get("meals") === "yes"}
                onChange={(e) => update("meals", e.target.checked ? "yes" : "")}
              />{" "}
              Meals provided
            </label>
          </div>
          <div className="filter-info">
            <ShieldCheck size={21} />
            <p>Every published vacancy is reviewed before it appears here.</p>
          </div>
        </aside>
        <div>
          <div className="results-heading">
            <p aria-live="polite" aria-atomic="true">
              <strong>{loading ? "…" : jobs.length}</strong>{" "}
              {jobs.length === 1 ? "opportunity" : "opportunities"}
              {city ? ` in ${params.get("city")}` : " to explore"}
            </p>
            <label>
              Sort by{" "}
              <select
                aria-label="Sort jobs"
                value={params.get("sort") || "newest"}
                onChange={(e) => update("sort", e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="salary">Highest salary</option>
              </select>
            </label>
          </div>
          {loading ? (
            <Loading />
          ) : jobs.length ? (
            <div className="search-job-grid">
              {jobs.map((j) => (
                <JobCard
                  key={j.id}
                  job={j}
                  company={state.companies.find((c) => c.id === j.companyId)}
                />
              ))}
            </div>
          ) : (
            <Empty
              title="No roles match these filters yet"
              description="Try another city, department, or salary range."
              action={
                <LinkButton href="/jobs" variant="secondary">
                  Clear filters
                </LinkButton>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
export function JobDetail({ id }: { id: string }) {
  const { state, loading } = useWorkspace();
  if (loading) return <Loading />;
  const job = publicJobs(state.jobs, state.companies).find((j) => j.id === id);
  if (!job)
    return (
      <div className="container page">
        <Empty
          title="This vacancy is unavailable"
          description="It may have closed or be waiting for approval."
          action={<LinkButton href="/jobs">Find another role</LinkButton>}
        />
      </div>
    );
  const company = state.companies.find((c) => c.id === job.companyId);
  const applied = state.applications.some(
    (a) => a.jobId === id && a.applicantId === state.userId,
  );
  const facts = [
    [MapPin, "Location", `${job.locality}, ${job.city}`],
    [
      BriefcaseBusiness,
      "Experience",
      `${job.experienceMin}${job.experienceMax ? `–${job.experienceMax}` : "+"} years`,
    ],
    [Clock3, "Shift", job.shift],
    [UsersRound, "Openings", String(job.openings)],
    [
      BedDouble,
      "Accommodation",
      job.accommodation ? "Provided" : "Not provided",
    ],
    [Utensils, "Meals", job.meals ? "Provided" : "Not provided"],
    [CalendarDays, "Join by", dateLabel(job.joiningBy)],
  ] as const;
  return (
    <div className="container page">
      <Link className="back-link" href="/jobs">
        ← Back to jobs
      </Link>
      <div className="detail-layout">
        <div>
          <div className="detail-header">
            <div className="job-card-top">
              <CompanyMark company={company} />
              <div>
                <Link
                  href={`/companies/${company?.id}`}
                  className="company-name"
                >
                  {company?.name}
                </Link>
                <p className="property-line">
                  {job.propertyType} · {job.city}
                </p>
              </div>
              <Badge tone="green">
                <ShieldCheck size={13} /> Reviewed employer
              </Badge>
              <SaveJobButton jobId={job.id} />
            </div>
            <h1>{job.title}</h1>
            <div className="job-tags">
              <Badge>{job.employmentType}</Badge>
              <Badge>{job.department}</Badge>
            </div>
          </div>
          <section className="panel">
            <h2>About the role</h2>
            <div className="prose-lines">{job.description}</div>
            {job.skills.length > 0 && (
              <>
                <h3>Skills that matter</h3>
                <div className="job-tags">
                  {job.skills.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
              </>
            )}
            {job.languages.length > 0 && (
              <>
                <h3>Languages</h3>
                <p>{job.languages.join(", ")}</p>
              </>
            )}
          </section>
          <section className="panel">
            <h2>The property</h2>
            <p>{company?.description}</p>
            <Link className="inline-link" href={`/companies/${job.companyId}`}>
              About {company?.name} <ArrowUpRight size={16} />
            </Link>
          </section>
          {job.questions.length > 0 && (
            <section className="panel">
              <h2>A few questions before you apply</h2>
              <p className="muted">
                You’ll answer {job.questions.length} short questions about this
                role. Your profile handles the rest.
              </p>
              <ul className="question-preview">
                {job.questions.map((q) => (
                  <li key={q.id}>
                    {q.label}
                    {q.dealBreaker && (
                      <Badge tone="sand">Hiring requirement</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="apply-panel">
          <p className="eyebrow">MONTHLY SALARY</p>
          <h2>
            {salary(job.salaryMin)}
            <br />
            <span>– {salary(job.salaryMax)}</span>
          </h2>
          <small>per month · INR</small>
          <LinkButton
            href={applied ? "/applicant/applications" : `/jobs/${job.id}/apply`}
            arrow
          >
            {applied ? "View your application" : "Apply for this role"}
          </LinkButton>
          <p className="apply-note">
            <Check size={14} /> Use your saved profile. No cover letter.
          </p>
          <div className="job-facts">
            {facts.map(([Icon, label, value]) => (
              <div key={label}>
                <Icon size={17} />
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
export function CompanyPage({ id }: { id: string }) {
  const { state, loading } = useWorkspace();
  if (loading) return <Loading />;
  const company = state.companies.find(
    (c) => c.id === id && c.status === "approved",
  );
  if (!company)
    return (
      <div className="container page">
        <Empty
          title="Employer unavailable"
          description="This employer's profile is not currently public."
        />
      </div>
    );
  const jobs = publicJobs(state.jobs, state.companies).filter(
    (j) => j.companyId === id,
  );
  return (
    <div className="container page">
      <Link href="/jobs" className="back-link">
        ← All jobs
      </Link>
      <div className="company-hero">
        <CompanyMark company={company} />
        <div>
          <Badge tone="green">
            <ShieldCheck size={14} />
            Reviewed employer
          </Badge>
          <h1>{company.name}</h1>
          <p>
            {company.type} · {company.city}
          </p>
        </div>
      </div>
      <section className="panel">
        <h2>About the company</h2>
        <p className="prose-lines">{company.description}</p>
        {company.website && (
          <a
            className="inline-link"
            href={
              /^https?:\/\//i.test(company.website)
                ? company.website
                : `https://${company.website}`
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit company website <ArrowUpRight size={15} />
          </a>
        )}
      </section>
      <div className="section-title">
        <h2>Open roles</h2>
        <span className="muted">{jobs.length} vacancies</span>
      </div>
      {jobs.length ? (
        <div className="job-grid">
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} company={company} />
          ))}
        </div>
      ) : (
        <Empty
          title="No open roles right now"
          description="Explore other hospitality employers while this team prepares its next vacancies."
          action={<LinkButton href="/jobs">Browse jobs</LinkButton>}
        />
      )}
    </div>
  );
}
