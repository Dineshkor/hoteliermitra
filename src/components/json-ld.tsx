import { getJobForMetadata } from "@/lib/metadata";

export async function JobJsonLd({ id }: { id: string }) {
  const job = await getJobForMetadata(id);
  if (!job) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: new Date().toISOString().slice(0, 10),
    hiringOrganization: {
      "@type": "Organization",
      name: job.companyName,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.locality,
        addressRegion: job.city,
        addressCountry: "IN",
      },
    },
    baseSalary: {
      "@type": "MonetaryAmount",
      currency: "INR",
      value: {
        "@type": "QuantitativeValue",
        minValue: job.salaryMin,
        maxValue: job.salaryMax,
        unitText: "MONTH",
      },
    },
    employmentType: job.employmentType === "Full time" ? "FULL_TIME"
      : job.employmentType === "Part time" ? "PART_TIME"
      : job.employmentType === "Contract" ? "CONTRACTOR"
      : job.employmentType === "Internship" ? "INTERN"
      : job.employmentType === "Seasonal" ? "TEMPORARY"
      : "OTHER",
    industry: "Hospitality",
    occupationalCategory: `${job.department} - ${job.title}`,
    ...(job.experienceMin > 0 && {
      experienceRequirements: {
        "@type": "OccupationalExperienceRequirements",
        monthsOfExperience: job.experienceMin * 12,
      },
    }),
    ...(job.skills.length > 0 && {
      skills: job.skills.join(", "),
    }),
    jobBenefits: [
      ...(job.accommodation ? ["Staff accommodation provided"] : []),
      ...(job.meals ? ["Meals provided"] : []),
    ].join(", ") || undefined,
    ...(job.joiningBy && {
      validThrough: job.joiningBy,
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
