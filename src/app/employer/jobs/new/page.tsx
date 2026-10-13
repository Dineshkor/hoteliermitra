import type { Metadata } from "next";
import { JobEditor } from "@/components/pages/employer";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Post a Vacancy",
};
export default function Page() {
  return <JobEditor key="new" />;
}
