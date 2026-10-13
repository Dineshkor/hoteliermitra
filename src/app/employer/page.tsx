import type { Metadata } from "next";
import { EmployerDashboard } from "@/components/pages/employer";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Employer Dashboard",
  description: "Manage your hospitality vacancies and review applications.",
};
export default function Page() {
  return <EmployerDashboard />;
}
