import type { Metadata } from "next";
import { ApplicantDashboard } from "@/components/pages/applicant";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Applicant Dashboard",
};
export default function Page() {
  return <ApplicantDashboard />;
}
