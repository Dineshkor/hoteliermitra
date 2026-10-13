import type { Metadata } from "next";
import { JobEditor } from "@/components/pages/employer";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit Vacancy",
};
type Props = { params: Promise<{ id: string }> };
export default async function Page({ params }: Props) {
  const { id } = await params;
  return <JobEditor key={id} id={id} />;
}
