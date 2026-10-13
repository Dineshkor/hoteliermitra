import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hospitalityhire.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/jobs", "/jobs/*", "/companies/*"],
        disallow: [
          "/applicant/",
          "/employer/",
          "/admin/",
          "/api/",
          "/login",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
