import type { Metadata } from "next";
import { Candidates } from "@/components/pages/candidates";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Applicants",
};
type Props = { params: Promise<{ id: string }> };
export default async function Page({ params }: Props) {
  const { id } = await params;
  return <Candidates id={id} />;
}
