import type { Metadata } from "next";
import { Home } from "@/components/pages/public";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Hospitality Hire · Good people. Great hospitality.",
  description:
    "Hospitality careers across India. Find hotel, restaurant, resort and cafe jobs, or hire your next hospitality team with structured profiles and screening.",
  openGraph: {
    title: "Hospitality Hire · Good people. Great hospitality.",
    description:
      "Find hotel, restaurant, resort and cafe jobs across India, or hire your next hospitality team.",
    type: "website",
  },
};
export default function Page() {
  return <Home />;
}
