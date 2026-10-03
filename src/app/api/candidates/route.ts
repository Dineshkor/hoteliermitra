import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import {
  parseCandidateQuery,
  publicDatabaseError,
} from "@/lib/supabase/actions";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const failure = (error: string, status = 400) =>
  NextResponse.json({ error }, { status, headers });

export async function GET(request: NextRequest) {
  if (!hasSupabaseConfig()) return failure("Supabase is not configured.", 503);
  let query;
  try {
    query = parseCandidateQuery(request.nextUrl.searchParams);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Invalid candidate filters.",
    );
  }
  try {
    const supabase = await createClient();
    const { data: claims, error: authError } = await supabase.auth.getClaims();
    if (authError || !claims?.claims?.sub)
      return failure("Sign in to continue.", 401);
    const { data, error } = await supabase.rpc("candidate_search", {
      job_id: query.jobId,
      filters: query.filters,
      page_number: query.page,
    });
    if (error) return failure(publicDatabaseError(error), 403);
    return NextResponse.json(data, { headers });
  } catch {
    return failure(
      "Candidates are temporarily unavailable. Please try again.",
      503,
    );
  }
}
