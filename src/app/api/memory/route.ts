import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// FR-11: per-user long-term memory — review, add, edit, delete.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const entries = await prisma.memoryEntry.findMany({
    where: { userId: auth.user.id },
    orderBy: { updatedAt: "desc" },
  });
  return Response.json({ entries });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = z.object({ content: z.string().min(1).max(2000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Write something to remember." }, { status: 400 });
  const entry = await prisma.memoryEntry.create({
    data: { userId: auth.user.id, content: parsed.data.content, source: "manual" },
  });
  await logAudit(auth.user.id, "memory.added", entry.content.slice(0, 120));
  return Response.json({ entry }, { status: 201 });
}
