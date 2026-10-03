import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/supabase/actions";

export async function GET(request: NextRequest) {
  const parameters = request.nextUrl.searchParams;
  const tokenHash = parameters.get("token_hash");
  const type = parameters.get("type");
  const code = parameters.get("code");
  const destination = safeNextPath(parameters.get("next"));
  if (hasSupabaseConfig()) {
    try {
      const supabase = await createClient();
      const result = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : tokenHash &&
            type &&
            [
              "email",
              "signup",
              "invite",
              "magiclink",
              "recovery",
              "email_change",
            ].includes(type)
          ? await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: type as EmailOtpType,
            })
          : null;
      if (result && !result.error)
        return NextResponse.redirect(new URL(destination, request.url));
    } catch {
      /* A confirmation failure is shown by the sign-in screen. */
    }
  }
  return NextResponse.redirect(
    new URL("/login?error=confirmation", request.url),
  );
}
