import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// FR-01 (restored): 7-day soft delete. The account stops working immediately and is
// permanently purged after 7 days (see scripts/purge-deleted.ts).
export async function POST() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  await prisma.user.update({
    where: { id: auth.user.id },
    data: { deletedAt: new Date(), tokenVersion: { increment: 1 } },
  });
  await logAudit(auth.user.id, "account.deleted", "Account scheduled for deletion (7-day window).");
  return Response.json({ ok: true, message: "Account scheduled for deletion. It will be permanently removed after 7 days." });
}
