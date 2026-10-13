import type { Metadata } from "next";
import { Jobs } from "@/components/pages/public";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Find Hospitality Jobs",
  description:
    "Browse hotel, restaurant, resort and cafe jobs across India. Filter by department, salary, city and benefits.",
  openGraph: {
    title: "Find Hospitality Jobs | Hospitality Hire",
    description:
      "Browse hotel, restaurant, resort and cafe jobs across India.",
  },
};
export default function Page() {
  return <Jobs />;
}
