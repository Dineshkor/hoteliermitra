import type { Metadata } from "next";
import { CandidateDetail } from "@/components/pages/candidates";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Candidate Details",
};
type Props = { params: Promise<{ id: string; appId: string }> };
export default async function Page({ params }: Props) {
  const { id, appId } = await params;
  return <CandidateDetail jobId={id} id={appId} />;
}
