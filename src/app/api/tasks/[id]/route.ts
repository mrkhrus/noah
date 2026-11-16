import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["approve", "reject", "pause", "resume", "cancel"]),
});

// FR-04: approval before any consequential action, plus pause / resume / cancel.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid action." }, { status: 400 });
  const task = await prisma.task.findFirst({ where: { id, userId: auth.user.id } });
  if (!task) return Response.json({ error: "Task not found." }, { status: 404 });

  const action = parsed.data.action;
  let data: Record<string, string> = {};
  if (action === "approve") {
    if (!task.needsApproval) return Response.json({ error: "This task does not need approval." }, { status: 400 });
    if (task.status === "done" || task.status === "cancelled") {
      return Response.json({ error: "This task is already finished." }, { status: 400 });
    }
    data = { approvalStatus: "approved" };
    await logAudit(auth.user.id, "task.approved", `"${task.title}" approved by the user.`);
  } else if (action === "reject") {
    data = { approvalStatus: "rejected", status: "cancelled" };
    await logAudit(auth.user.id, "task.rejected", `"${task.title}" rejected by the user.`);
  } else if (action === "pause") {
    if (task.status !== "queued" && task.status !== "running") {
      return Response.json({ error: "Only a queued or running task can be paused." }, { status: 400 });
    }
    data = { status: "paused" };
    await logAudit(auth.user.id, "task.paused", `"${task.title}" paused.`);
  } else if (action === "resume") {
    if (task.status !== "paused") {
      return Response.json({ error: "Only a paused task can be resumed." }, { status: 400 });
    }
    data = { status: "queued" };
    await logAudit(auth.user.id, "task.resumed", `"${task.title}" resumed.`);
  } else if (action === "cancel") {
    if (task.status === "done") {
      return Response.json({ error: "A finished task cannot be cancelled." }, { status: 400 });
    }
    data = { status: "cancelled" };
    await logAudit(auth.user.id, "task.cancelled", `"${task.title}" cancelled.`);
  }
  const updated = await prisma.task.update({ where: { id: task.id }, data });
  return Response.json({ task: updated });
}
