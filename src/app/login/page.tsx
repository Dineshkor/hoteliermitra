import type { Metadata } from "next";
import { Login } from "@/components/pages/login";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Hospitality Hire account.",
};
export default function Page() {
  return <Login />;
}
