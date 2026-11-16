import { clearSessionCookie, getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (user) await logAudit(user.id, "auth.logout", "Logged out.");
  await clearSessionCookie();
  return Response.json({ ok: true });
}
