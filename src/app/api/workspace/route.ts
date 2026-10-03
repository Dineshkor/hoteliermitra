import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { parseAction, publicDatabaseError } from "@/lib/supabase/actions";
import {
  MAX_BODY_BYTES,
  RequestBodyTooLarge,
  readCappedBody,
} from "@/lib/supabase/request-body";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const failure = (error: string, status = 400) =>
  NextResponse.json({ error }, { status, headers });

export async function GET() {
  if (!hasSupabaseConfig()) return failure("Supabase is not configured.", 503);
  try {
    const supabase = await createClient();
    // Never derive authorization from an unverified cookie session.
    await supabase.auth.getClaims();
    const { data, error } = await supabase.rpc("workspace_snapshot");
    if (error)
      return failure(
        "We could not load your workspace. Check the database setup and try again.",
        503,
      );
    return NextResponse.json({ workspace: data }, { headers });
  } catch {
    return failure(
      "Your workspace is temporarily unavailable. Please try again.",
      503,
    );
  }
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseConfig()) return failure("Supabase is not configured.", 503);
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin)
    return failure("This request must come from the application.", 403);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES)
    return failure("This form is too large.", 413);
  try {
    const supabase = await createClient();
    const { data: claims, error: authError } = await supabase.auth.getClaims();
    if (authError || !claims?.claims?.sub)
      return failure("Sign in to continue.", 401);
    const body = await readCappedBody(request.body);
    let action;
    try {
      action = parseAction(JSON.parse(body));
    } catch (error) {
      return failure(
        error instanceof SyntaxError
          ? "Invalid JSON request."
          : error instanceof Error
            ? error.message
            : "Invalid request.",
      );
    }
    const { data, error } = await supabase.rpc("workspace_action", {
      action: action.action,
      payload: action.payload,
    });
    if (error)
      return failure(
        publicDatabaseError(error),
        error.code === "42501" ? 403 : 400,
      );
    return NextResponse.json({ workspace: data }, { headers });
  } catch (error) {
    if (error instanceof RequestBodyTooLarge)
      return failure(error.message, 413);
    return failure("We could not save this change. Please try again.", 503);
  }
}
