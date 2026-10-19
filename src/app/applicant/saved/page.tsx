import type { Metadata } from "next";
import { Saved } from "@/components/pages/applicant";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Saved Jobs & Alerts",
};
export default function Page() {
  return <Saved />;
}
