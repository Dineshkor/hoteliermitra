import type { Metadata } from "next";
import { CompanyEditor } from "@/components/pages/employer";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Company Profile",
};
export default function Page() {
  return <CompanyEditor />;
}
