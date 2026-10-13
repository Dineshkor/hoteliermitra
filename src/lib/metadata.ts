import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createDemo } from "@/lib/demo";
import { publicJobs } from "@/lib/domain";
import { salary } from "@/lib/taxonomy";
import type { Company, Job } from "@/lib/types";

type MetaData = { jobs: Job[]; companies: Company[] };

type JobMeta = {
  title: string;
  companyName: string;
  city: string;
  department: string;
  description: string;
  salaryRange: string;
  salaryMin: number;
  salaryMax: number;
  propertyType: string;
  locality: string;
  experienceMin: number;
  experienceMax: number | null;
  shift: string;
  employmentType: string;
  accommodation: boolean;
  meals: boolean;
  openings: number;
  joiningBy: string;
  skills: string[];
};

type CompanyMeta = {
  name: string;
  type: string;
  city: string;
  description: string;
};

async function getDemoData(): Promise<MetaData> {
  const demo = createDemo();
  return { jobs: demo.jobs, companies: demo.companies };
}

async function getSupabaseData(): Promise<MetaData | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.rpc("workspace_snapshot");
    if (!data) return null;
    return { jobs: data.jobs || [], companies: data.companies || [] };
  } catch {
    return null;
  }
}

async function getData(): Promise<MetaData> {
  if (!hasSupabaseConfig()) return getDemoData();
  const data = await getSupabaseData();
  if (!data) {
    console.error(
      "Supabase is configured but workspace_snapshot() returned no data; serving empty metadata instead of demo fixtures.",
    );
    return { jobs: [], companies: [] };
  }
  return data;
}

export async function getJobForMetadata(
  id: string,
): Promise<JobMeta | null> {
  const data = await getData();
  const jobs = publicJobs(data.jobs, data.companies);
  const job = jobs.find((j) => j.id === id);
  if (!job) return null;
  const company = data.companies.find((c) => c.id === job.companyId);
  return {
    title: job.title,
    companyName: company?.name || "Employer",
    city: job.city,
    department: job.department,
    description: job.description,
    salaryRange: `${salary(job.salaryMin)}–${salary(job.salaryMax)}`,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    propertyType: job.propertyType,
    locality: job.locality,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    shift: job.shift,
    employmentType: job.employmentType,
    accommodation: job.accommodation,
    meals: job.meals,
    openings: job.openings,
    joiningBy: job.joiningBy,
    skills: job.skills,
  };
}

export async function getCompanyForMetadata(
  id: string,
): Promise<CompanyMeta | null> {
  const data = await getData();
  const company = data.companies.find(
    (c) => c.id === id && c.status === "approved",
  );
  if (!company) return null;
  return {
    name: company.name,
    type: company.type,
    city: company.city,
    description: company.description,
  };
}

export async function getPublicJobsForSitemap(): Promise<
  { id: string; updatedAt: string }[]
> {
  const data = await getData();
  return publicJobs(data.jobs, data.companies).map((j) => ({
    id: j.id,
    updatedAt: j.createdAt,
  }));
}

export async function getCompaniesForSitemap(): Promise<
  { id: string }[]
> {
  const data = await getData();
  return data.companies
    .filter((c) => c.status === "approved")
    .map((c) => ({ id: c.id }));
}
