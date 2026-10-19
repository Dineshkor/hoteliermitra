import { describe, expect, it } from "vitest";
import {
  parseAction,
  parseCandidateQuery,
  publicDatabaseError,
  safeNextPath,
} from "./actions";

describe("workspace request boundary", () => {
  it("rejects unknown actions and non-object payloads", () => {
    expect(() => parseAction({ action: "role.admin", payload: {} })).toThrow(
      "Unsupported action",
    );
    expect(() => parseAction({ action: "job.close", payload: [] })).toThrow(
      "Invalid request",
    );
    expect(() => parseAction({ action: "job.close", payload: {} })).toThrow(
      "Record ID is required",
    );
  });
  it("permits only the documented status changes", () => {
    expect(() =>
      parseAction({
        action: "application.status",
        payload: { id: "a", status: "approved" },
      }),
    ).toThrow("Invalid application status");
    expect(parseAction({ action: "job.close", payload: { id: "a" } })).toEqual({
      action: "job.close",
      payload: { id: "a" },
    });
  });
  it("hides database internals but preserves authored validation messages", () => {
    expect(
      publicDatabaseError({
        code: "23505",
        message: "secret.users internal constraint",
      }),
    ).toBe("This record already exists. Refresh and try again.");
    expect(
      publicDatabaseError({
        code: "P0001",
        message: "HH: Your account is suspended.",
      }),
    ).toBe("Your account is suspended.");
    expect(
      publicDatabaseError({
        code: "P0001",
        message: "relation secret_table not found",
      }),
    ).toBe("We could not save this change. Please try again.");
  });
  it("allows local confirmation redirects and blocks external destinations", () => {
    expect(safeNextPath("/employer?tab=jobs")).toBe("/employer?tab=jobs");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
  });
  it("accepts the saved actions and rejects malformed payloads", () => {
    expect(
      parseAction({
        action: "savedJob.toggle",
        payload: { jobId: "commis-chef", saved: true },
      }),
    ).toEqual({
      action: "savedJob.toggle",
      payload: { jobId: "commis-chef", saved: true },
    });
    expect(
      parseAction({
        action: "savedSearch.save",
        payload: {
          id: "",
          name: "Kitchen jobs",
          filters: {},
          alerts: true,
          createdAt: "2026-10-19T00:00:00.000Z",
        },
      }),
    ).toMatchObject({ action: "savedSearch.save" });
    expect(
      parseAction({
        action: "savedSearch.alerts",
        payload: { id: "s1", alerts: false },
      }),
    ).toEqual({
      action: "savedSearch.alerts",
      payload: { id: "s1", alerts: false },
    });
    for (const bad of [
      { action: "savedJob.toggle", payload: { jobId: "j", saved: "yes" } },
      { action: "savedJob.toggle", payload: { jobId: "", saved: true } },
      {
        action: "savedSearch.save",
        payload: { name: " ", filters: {}, alerts: true },
      },
      {
        action: "savedSearch.save",
        payload: { name: "x".repeat(101), filters: [], alerts: true },
      },
      {
        action: "savedSearch.save",
        payload: { name: "ok", filters: {}, alerts: "on" },
      },
      {
        action: "savedSearch.alerts",
        payload: { id: "s1", alerts: "off" },
      },
      { action: "savedSearch.delete", payload: {} },
    ])
      expect(() => parseAction(bad)).toThrow();
  });
});

describe("candidate query boundary", () => {
  it("retains a bounded candidate identity for an owned detail lookup", () => {
    expect(
      parseCandidateQuery(new URLSearchParams("jobId=j&applicationId=a&page=1")),
    ).toEqual({ jobId: "j", page: 1, filters: { applicationId: "a" } });
    expect(() =>
      parseCandidateQuery(
        new URLSearchParams({ jobId: "j", applicationId: "a".repeat(101) }),
      ),
    ).toThrow("Application ID is too long");
  });
  it("provides one-based pagination and typed filter values", () => {
    expect(
      parseCandidateQuery(
        new URLSearchParams(
          "jobId=j&experienceMin=2&salaryMax=30000&relocate=false&sort=salary",
        ),
      ),
    ).toEqual({
      jobId: "j",
      page: 1,
      filters: {
        experienceMin: 2,
        salaryMax: 30000,
        relocate: false,
        sort: "salary",
      },
    });
    expect(
      parseCandidateQuery(new URLSearchParams("jobId=j&page=2&city=")),
    ).toEqual({ jobId: "j", page: 2, filters: {} });
  });
  it("rejects invalid pagination, filters and absent job identity", () => {
    for (const query of [
      "jobId=j&page=0",
      "jobId=j&experienceMin=-1",
      "jobId=j&experienceMax=Infinity",
      "jobId=j&relocate=maybe",
      "jobId=j&status=approved",
      "jobId=j&sort=random",
      "page=1",
    ]) {
      expect(() => parseCandidateQuery(new URLSearchParams(query))).toThrow();
    }
  });
});
