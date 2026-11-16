import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// FR-12: reminders.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const reminders = await prisma.reminder.findMany({
    where: { userId: auth.user.id },
    orderBy: { dueAt: "asc" },
  });
  return Response.json({ reminders });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = z
    .object({ title: z.string().min(1).max(200), dueAt: z.string().datetime() })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Give a title and a valid due time." }, { status: 400 });
  const reminder = await prisma.reminder.create({
    data: { userId: auth.user.id, title: parsed.data.title, dueAt: new Date(parsed.data.dueAt) },
  });
  await logAudit(auth.user.id, "reminder.created", `"${reminder.title}" due ${reminder.dueAt.toISOString()}.`);
  return Response.json({ reminder }, { status: 201 });
}
