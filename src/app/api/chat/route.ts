import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { generateChatReply, geminiConfigured, geminiSetupMessage } from "@/lib/gemini";
import {
  getConnectedGoogleClient,
  recentDriveFiles,
  searchGmail,
  upcomingCalendar,
  type RetrievedSource,
} from "@/lib/google";
import { getUserScopes } from "@/lib/scope";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1, "Write a message first.").max(4000),
});

function wants(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w));
}

/** Real chat (FR-02): answers come from Google Gemini, with citations from the user's own connected data. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { message } = parsed.data;

  if (!geminiConfigured()) {
    return Response.json({ error: geminiSetupMessage(), needsSetup: "gemini" }, { status: 503 });
  }

  // Conversation (create if needed).
  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const owned = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: auth.user.id },
    });
    if (!owned) return Response.json({ error: "Conversation not found." }, { status: 404 });
  } else {
    const conv = await prisma.conversation.create({
      data: { userId: auth.user.id, title: message.slice(0, 60) || "New conversation" },
    });
    conversationId = conv.id;
  }

  // Long-term memory (FR-11) and recent history for context.
  const memory = await prisma.memoryEntry.findMany({
    where: { userId: auth.user.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { content: true },
  });
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { role: true, content: true },
  });

  // Retrieve real data from the user's connected accounts when the question is about them.
  const sources: RetrievedSource[] = [];
  let missingScope: string | null = null;
  const scopes = await getUserScopes(auth.user.id);
  const conn = await getConnectedGoogleClient(auth.user.id).catch((err: Error) => {
    // Expired token etc. — surface honestly instead of failing silently.
    throw err;
  });

  if (wants(message, ["email", "mail", "inbox", "message from", "sent me"])) {
    if (!conn) missingScope = "Connect your Google account in Accounts to let NOAH read your email.";
    else if (!scopes.gmail) missingScope = "Gmail is disabled in your scope settings. Enable it in Settings to let NOAH read your email.";
    else sources.push(...(await searchGmail(conn.client, "in:inbox", 5)));
  }
  if (wants(message, ["calendar", "event", "meeting", "schedule", "appointment", "tomorrow", "today", "next week"])) {
    if (!conn) missingScope = "Connect your Google account in Accounts to let NOAH read your calendar.";
    else if (!scopes.calendar) missingScope = "Calendar is disabled in your scope settings. Enable it in Settings to let NOAH read your calendar.";
    else sources.push(...(await upcomingCalendar(conn.client, 5)));
  }
  if (wants(message, ["drive", "file", "document", "doc ", "sheet", "spreadsheet", "my files"])) {
    if (!conn) missingScope = "Connect your Google account in Accounts to let NOAH read your Drive files.";
    else if (!scopes.drive) missingScope = "Drive is disabled in your scope settings. Enable it in Settings to let NOAH list your files.";
    else sources.push(...(await recentDriveFiles(conn.client, 5)));
  }

  let reply: string;
  try {
    const result = await generateChatReply(message, {
      history: history.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      memory: memory.map((m) => m.content),
      sources,
    });
    reply = result.text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "The AI service failed. Please try again.";
    return Response.json({ error: msg }, { status: 502 });
  }

  if (missingScope) {
    reply += `\n\nNote: ${missingScope}`;
  }

  await prisma.message.createMany({
    data: [
      { conversationId, role: "user", content: message },
      { conversationId, role: "assistant", content: reply, citations: JSON.stringify(sources) },
    ],
  });
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

  return Response.json({ conversationId, reply, sources });
}
