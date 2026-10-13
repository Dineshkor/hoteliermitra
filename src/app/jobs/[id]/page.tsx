import type { Metadata } from "next";
import { JobDetail } from "@/components/pages/public";
import { JobJsonLd } from "@/components/json-ld";
import { getJobForMetadata } from "@/lib/metadata";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobForMetadata(id);
  if (!job) return { title: "Job Not Found" };
  return {
    title: `${job.title} at ${job.companyName} · ${job.city}`,
    description: `${job.salaryRange} per month. ${job.department} role at ${job.companyName} in ${job.city}. ${job.description.slice(0, 150)}...`,
    openGraph: {
      title: `${job.title} — ${job.companyName}`,
      description: `${job.salaryRange}/month · ${job.city} · ${job.department}`,
      type: "article",
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <>
      <JobJsonLd id={id} />
      <JobDetail id={id} />
    </>
  );
}
