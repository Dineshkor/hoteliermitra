import type { Metadata } from "next";
import { Apply } from "@/components/pages/applicant";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Apply for This Role",
};

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <Apply key={id} id={id} />;
}
