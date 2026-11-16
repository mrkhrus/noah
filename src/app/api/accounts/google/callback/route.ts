import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getOAuthClient, CONNECT_SCOPES } from "@/lib/google";
import { encrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/mailer";

export const dynamic = "force-dynamic";

function baseUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.redirect(new URL("/login", baseUrl()));
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(new URL("/accounts?error=connect_cancelled", baseUrl()));
  try {
    const client = getOAuthClient("/api/accounts/google/callback");
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    const providerEmail = me.data.email;
    if (!providerEmail || !tokens.access_token) {
      return Response.redirect(new URL("/accounts?error=connect_no_email", baseUrl()));
    }
    const grantedScopes = (tokens.scope ?? CONNECT_SCOPES.join(" ")).split(" ");
    await prisma.connectedAccount.upsert({
      where: {
        userId_provider_providerEmail: { userId: user.id, provider: "google", providerEmail },
      },
      update: {
        scopes: grantedScopes.join(" "),
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      create: {
        userId: user.id,
        provider: "google",
        providerEmail,
        scopes: grantedScopes.join(" "),
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });
    await logAudit(user.id, "account.connected", `Google account ${providerEmail} connected.`);
    return Response.redirect(new URL("/accounts?connected=1", baseUrl()));
  } catch (err) {
    console.error("[NOAH google connect] failed:", err);
    return Response.redirect(new URL("/accounts?error=connect_failed", baseUrl()));
  }
}
