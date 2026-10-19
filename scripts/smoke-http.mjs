import assert from "node:assert/strict";
const origin = process.env.SMOKE_ORIGIN || "http://127.0.0.1:3001";
for (const route of [
  "/",
  "/jobs",
  "/jobs/commis-chef",
  "/applicant/profile",
  "/applicant/saved",
  "/employer",
  "/admin",
  "/login",
]) {
  const response = await fetch(`${origin}${route}`);
  assert.equal(response.status, 200, `${route} status`);
  const html = await response.text();
  assert.match(html, /Hospitality Hire|hospitalityhire|hospitality/);
  assert.doesNotMatch(html, /We couldn’t load this page/);
  console.log(`PASS ${route}`);
}
const missing = await fetch(`${origin}/unknown-page`);
assert.equal(missing.status, 404);
console.log("PASS unknown route returns 404");
const workspace = await fetch(`${origin}/api/workspace`);
assert.equal(workspace.status, 503);
assert.equal((await workspace.json()).error, "Supabase is not configured.");
console.log("PASS unconfigured API explicitly unavailable");
