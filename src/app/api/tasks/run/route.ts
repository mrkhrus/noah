import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { runNextTaskForUser } from "@/lib/tasks";

export const dynamic = "force-dynamic";

/** User-triggered: run the next queued task (FIFO) for the signed-in user. */
export async function POST() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const result = await runNextTaskForUser(auth.user.id);
  return Response.json(result);
}

/** Vercel Cron: runs one queued, approved task per user. Protected by CRON_SECRET. */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      tasks: { some: { status: "queued", approvalStatus: { in: ["approved", "none"] } } },
    },
    select: { id: true },
  });
  const results: { userId: string; message: string }[] = [];
  for (const u of users) {
    const r = await runNextTaskForUser(u.id);
    results.push({ userId: u.id, message: r.message });
  }
  return Response.json({ ran: results.length, results });
}
