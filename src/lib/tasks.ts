import { prisma } from "./db";
import { logAudit } from "./mailer";
import {
  createCalendarEvent,
  createGmailDraft,
  getConnectedGoogleClient,
  searchGmail,
  sendGmail,
  upcomingCalendar,
} from "./google";
import { generateSummary } from "./gemini";
import { getUserScopes } from "./scope";

/**
 * FR-04 task queue runner — FIFO, one task at a time.
 * A task only runs when it does not need approval, or its approvalStatus is "approved".
 * Consequential actions (send email, create event) are never run without approval.
 * Called from POST /api/tasks/run (user-triggered) and from Vercel Cron (see vercel.json).
 */
export async function runNextTaskForUser(userId: string): Promise<{
  ran: boolean;
  taskId?: string;
  message: string;
}> {
  const task = await prisma.task.findFirst({
    where: { userId, status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  if (!task) return { ran: false, message: "No queued tasks." };

  if (task.needsApproval && task.approvalStatus !== "approved") {
    return {
      ran: false,
      taskId: task.id,
      message: "Task is waiting for your approval before it can run.",
    };
  }

  await prisma.task.update({ where: { id: task.id }, data: { status: "running" } });
  try {
    const result = await executeTask(userId, task.type, JSON.parse(task.payload || "{}"));
    await prisma.task.update({
      where: { id: task.id },
      data: { status: "done", result },
    });
    await logAudit(userId, "task.done", `${task.title}: ${result.slice(0, 200)}`);
    return { ran: true, taskId: task.id, message: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Task failed.";
    await prisma.task.update({
      where: { id: task.id },
      data: { status: "failed", error: message },
    });
    await logAudit(userId, "task.failed", `${task.title}: ${message}`);
    return { ran: true, taskId: task.id, message: `Task failed: ${message}` };
  }
}

async function executeTask(
  userId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const scopes = await getUserScopes(userId);

  if (type === "summary") {
    // Read-only summary of the user's inbox / calendar (FR-02 summarise).
    const conn = await getConnectedGoogleClient(userId);
    if (!conn) {
      throw new Error("No Google account connected. Connect one in Accounts first.");
    }
    const parts: string[] = [];
    if (scopes.gmail) {
      const mails = await searchGmail(conn.client, "in:inbox", 5);
      parts.push(
        "Recent emails:\n" + mails.map((m) => `- ${m.label} — ${m.detail}`).join("\n"),
      );
    }
    if (scopes.calendar) {
      const events = await upcomingCalendar(conn.client, 5);
      parts.push(
        "Upcoming events:\n" + events.map((e) => `- ${e.label} — ${e.detail}`).join("\n"),
      );
    }
    if (parts.length === 0) {
      throw new Error("No services are enabled in scope settings. Enable Gmail or Calendar first.");
    }
    const summary = await generateSummary(
      `Summarise the following for the user in short bullet points, in the user's language (English unless the request says otherwise):\n\n${parts.join("\n\n")}`,
    );
    return summary;
  }

  if (type === "email_send") {
    if (!scopes.gmail) throw new Error("Gmail is disabled in your scope settings.");
    const conn = await getConnectedGoogleClient(userId);
    if (!conn) throw new Error("No Google account connected.");
    const to = String(payload.to ?? "");
    const subject = String(payload.subject ?? "");
    const body = String(payload.body ?? "");
    if (!to || !subject) throw new Error("Email task is missing a recipient or subject.");
    const id = await sendGmail(conn.client, to, subject, body);
    await logAudit(userId, "email.sent", `To ${to}, subject "${subject}" (Gmail id ${id}).`);
    return `Email sent to ${to}.`;
  }

  if (type === "email_draft") {
    if (!scopes.gmail) throw new Error("Gmail is disabled in your scope settings.");
    const conn = await getConnectedGoogleClient(userId);
    if (!conn) throw new Error("No Google account connected.");
    const to = String(payload.to ?? "");
    const subject = String(payload.subject ?? "");
    const body = String(payload.body ?? "");
    if (!to || !subject) throw new Error("Email draft is missing a recipient or subject.");
    const id = await createGmailDraft(conn.client, to, subject, body);
    await logAudit(userId, "email.drafted", `Draft for ${to}, subject "${subject}" (draft id ${id}).`);
    return `Draft created in Gmail for ${to}. Nothing was sent.`;
  }

  if (type === "calendar_create") {
    if (!scopes.calendar) throw new Error("Calendar is disabled in your scope settings.");
    const conn = await getConnectedGoogleClient(userId);
    if (!conn) throw new Error("No Google account connected.");
    const title = String(payload.title ?? "");
    const start = String(payload.start ?? "");
    const end = String(payload.end ?? "");
    if (!title || !start || !end) {
      throw new Error("Calendar task is missing a title, start or end time.");
    }
    const id = await createCalendarEvent(
      conn.client,
      title,
      start,
      end,
      String(payload.description ?? ""),
    );
    await logAudit(userId, "calendar.created", `"${title}" on ${start} (event id ${id}).`);
    return `Calendar event "${title}" created.`;
  }

  throw new Error(`Unknown task type: ${type}`);
}
