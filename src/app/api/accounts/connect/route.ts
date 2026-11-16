import { getAuthUrl, googleOAuthConfigured } from "@/lib/google";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Starts per-user Google account connection (FR-07): Gmail, Calendar, Drive, Docs, Sheets.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (!googleOAuthConfigured()) {
    return Response.json(
      { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see DEPLOY.md)." },
      { status: 503 },
    );
  }
  return Response.redirect(getAuthUrl("connect"));
}
