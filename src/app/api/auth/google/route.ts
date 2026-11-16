import { getAuthUrl, googleOAuthConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

// Starts Google sign-in (FR-01). Redirects to Google's consent screen.
export async function GET() {
  if (!googleOAuthConfigured()) {
    return Response.redirect(
      new URL("/login?error=google_not_configured", process.env.APP_URL ?? "http://localhost:3000"),
    );
  }
  return Response.redirect(getAuthUrl("signin"));
}
