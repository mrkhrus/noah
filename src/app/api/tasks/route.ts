import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1, "Give the task a title.").max(200),
  type: z.enum(["summary", "email_send", "email_draft", "calendar_create"]),
  payload: z.record(z.string(), z.unknown()).default({}),
  // Consequential actions (send email, create event) always need approval.
  // Read-only summaries do not.
  needsApproval: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const tasks = await prisma.task.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return Response.json({ tasks });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { title, type, payload } = parsed.data;
  const consequential = type === "email_send" || type === "calendar_create";
  const needsApproval = parsed.data.needsApproval ?? consequential;
  const task = await prisma.task.create({
    data: {
      userId: auth.user.id,
      title,
      type,
      payload: JSON.stringify(payload),
      needsApproval,
      approvalStatus: needsApproval ? "pending" : "none",
    },
  });
  await logAudit(auth.user.id, "task.created", `"${title}" (${type}).`);
  return Response.json({ task }, { status: 201 });
}
