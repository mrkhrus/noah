import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const parsed = z.object({ content: z.string().min(1).max(2000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Write something to remember." }, { status: 400 });
  const entry = await prisma.memoryEntry.findFirst({ where: { id, userId: auth.user.id } });
  if (!entry) return Response.json({ error: "Memory not found." }, { status: 404 });
  const updated = await prisma.memoryEntry.update({ where: { id }, data: { content: parsed.data.content } });
  await logAudit(auth.user.id, "memory.edited", updated.content.slice(0, 120));
  return Response.json({ entry: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const entry = await prisma.memoryEntry.findFirst({ where: { id, userId: auth.user.id } });
  if (!entry) return Response.json({ error: "Memory not found." }, { status: 404 });
  await prisma.memoryEntry.delete({ where: { id } });
  await logAudit(auth.user.id, "memory.deleted", entry.content.slice(0, 120));
  return Response.json({ ok: true });
}
