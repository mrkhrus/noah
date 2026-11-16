import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { getOAuthClient } from "@/lib/google";
import { logAudit } from "@/lib/mailer";

export const dynamic = "force-dynamic";

function baseUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error || !code) {
    return Response.redirect(new URL("/login?error=google_cancelled", baseUrl()));
  }
  try {
    const client = getOAuthClient("/api/auth/google/callback");
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    const email = me.data.email;
    const googleId = me.data.id;
    if (!email || !googleId) {
      return Response.redirect(new URL("/login?error=google_no_email", baseUrl()));
    }
    let user = await prisma.user.findFirst({
      where: { OR: [{ email }, { googleId }] },
    });
    if (user?.deletedAt) {
      return Response.redirect(new URL("/login?error=account_deleted", baseUrl()));
    }
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: me.data.name ?? null,
          googleId,
          emailVerified: new Date(), // Google has verified this email.
          settings: { create: {} },
        },
      });
      await logAudit(user.id, "auth.signup_google", "Account created with Google sign-in.");
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, emailVerified: user.emailVerified ?? new Date() },
      });
    }
    const token = await createSession(user.id, user.tokenVersion);
    await setSessionCookie(token);
    await logAudit(user.id, "auth.login", "Google sign-in.");
    return Response.redirect(new URL("/chat", baseUrl()));
  } catch (err) {
    console.error("[NOAH google sign-in] failed:", err);
    return Response.redirect(new URL("/login?error=google_failed", baseUrl()));
  }
}
