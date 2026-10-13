import type { Metadata } from "next";
import { EmployerJobs } from "@/components/pages/employer";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Vacancies",
};
export default function Page() {
  return <EmployerJobs />;
}
