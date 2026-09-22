import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Handles both the PKCE `?code=` link and the `?token_hash=&type=` email template link.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const errorDescription = searchParams.get("error_description") ?? "";
  if (!ok) {
    const reason = /not.?authori|saving new user/i.test(errorDescription) ? "not_authorized" : "link_invalid";
    return NextResponse.redirect(`${origin}/login?error=${reason}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
