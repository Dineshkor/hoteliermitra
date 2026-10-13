import type { Metadata } from "next";
import { CompanyPage } from "@/components/pages/public";
import { getCompanyForMetadata } from "@/lib/metadata";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const company = await getCompanyForMetadata(id);
  if (!company) return { title: "Employer Not Found" };
  return {
    title: `${company.name} · ${company.type} in ${company.city}`,
    description: company.description.slice(0, 160),
    openGraph: {
      title: `${company.name} | Hospitality Hire`,
      description: `${company.type} in ${company.city}`,
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <CompanyPage id={id} />;
}
