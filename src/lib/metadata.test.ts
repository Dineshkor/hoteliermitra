import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCompanyForMetadata,
  getJobForMetadata,
  getPublicJobsForSitemap,
} from "@/lib/metadata";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));

const DEMO_JOB_ID = "front-desk";
const DEMO_COMPANY_ID = "harbor";

describe("metadata data source", () => {
  beforeEach(() => {
    rpc.mockReset();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  });

  describe("when Supabase is configured", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    });

    it("returns no sitemap entries when the snapshot read yields no data", async () => {
      rpc.mockResolvedValue({ data: null });

      expect(await getPublicJobsForSitemap()).toEqual([]);
    });

    it("returns no sitemap entries when the snapshot read throws", async () => {
      rpc.mockRejectedValue(new Error("connection reset"));

      expect(await getPublicJobsForSitemap()).toEqual([]);
    });

    it("returns no metadata for a demo job id when the snapshot read throws", async () => {
      rpc.mockRejectedValue(new Error("connection reset"));

      expect(await getJobForMetadata(DEMO_JOB_ID)).toBeNull();
      expect(await getCompanyForMetadata(DEMO_COMPANY_ID)).toBeNull();
    });

    it("returns metadata built only from the database snapshot", async () => {
      rpc.mockResolvedValue({
        data: {
          jobs: [
            {
              id: "live-job",
              companyId: "live-company",
              status: "approved",
              title: "Line Cook",
              department: "Kitchen",
              city: "Goa",
              description: "Cook on a live line.",
              salaryMin: 20000,
              salaryMax: 30000,
              propertyType: "Restaurant",
              locality: "Panaji",
              experienceMin: 1,
              experienceMax: 3,
              shift: "Day shift",
              employmentType: "Full time",
              accommodation: false,
              meals: false,
              openings: 1,
              joiningBy: "2026-12-01",
              skills: ["Food safety"],
              createdAt: "2026-10-01T00:00:00.000Z",
            },
          ],
          companies: [
            {
              id: "live-company",
              status: "approved",
              name: "Live Kitchen",
              type: "Restaurant",
              city: "Goa",
              description: "A real employer.",
            },
          ],
        },
      });

      const job = await getJobForMetadata("live-job");

      expect(job?.companyName).toBe("Live Kitchen");
      expect(await getPublicJobsForSitemap()).toEqual([
        { id: "live-job", updatedAt: "2026-10-01T00:00:00.000Z" },
      ]);
    });
  });

  describe("when Supabase is not configured", () => {
    it("still serves the local demo fixtures", async () => {
      const job = await getJobForMetadata(DEMO_JOB_ID);

      expect(job?.title).toBe("Front Desk Associate");
      expect((await getPublicJobsForSitemap()).length).toBeGreaterThan(0);
    });
  });
});