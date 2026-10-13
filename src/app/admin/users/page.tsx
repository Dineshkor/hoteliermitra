import type { Metadata } from "next";
import { Admin } from "@/components/pages/admin";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin · Manage Accounts",
};
export default function Page() {
  return <Admin manage />;
}
