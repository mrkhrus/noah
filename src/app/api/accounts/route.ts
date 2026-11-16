import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, provider: true, providerEmail: true, scopes: true, createdAt: true },
  });
  return Response.json({ accounts });
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const account = await prisma.connectedAccount.findFirst({
    where: { id: parsed.data.id, userId: auth.user.id },
  });
  if (!account) return Response.json({ error: "Account not found." }, { status: 404 });
  await prisma.connectedAccount.delete({ where: { id: account.id } });
  await logAudit(auth.user.id, "account.disconnected", `Google account ${account.providerEmail} disconnected.`);
  return Response.json({ ok: true });
}
