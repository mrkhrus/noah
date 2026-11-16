import { prisma } from "@/lib/db";
import { clearSessionCookie, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// FR-01 (restored): "Log Out All Devices" — invalidates every session by bumping tokenVersion.
export async function POST() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  await prisma.user.update({
    where: { id: auth.user.id },
    data: { tokenVersion: { increment: 1 } },
  });
  await logAudit(auth.user.id, "auth.logout_all", "Logged out of all devices.");
  await clearSessionCookie();
  return Response.json({ ok: true, message: "Signed out on all devices." });
}
