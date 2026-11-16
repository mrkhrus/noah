import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const parsed = z.object({ done: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const reminder = await prisma.reminder.findFirst({ where: { id, userId: auth.user.id } });
  if (!reminder) return Response.json({ error: "Reminder not found." }, { status: 404 });
  const updated = await prisma.reminder.update({ where: { id }, data: { done: parsed.data.done } });
  return Response.json({ reminder: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const reminder = await prisma.reminder.findFirst({ where: { id, userId: auth.user.id } });
  if (!reminder) return Response.json({ error: "Reminder not found." }, { status: 404 });
  await prisma.reminder.delete({ where: { id } });
  return Response.json({ ok: true });
}
