import type { Metadata } from "next";
import { Applications } from "@/components/pages/applicant";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Applications",
};
export default function Page() {
  return <Applications />;
}
