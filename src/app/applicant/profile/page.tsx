import type { Metadata } from "next";
import { Profile } from "@/components/pages/applicant";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Profile",
  description: "Build your reusable hospitality profile. Fill it once, use it for every application.",
};
export default function Page() {
  return <Profile />;
}
