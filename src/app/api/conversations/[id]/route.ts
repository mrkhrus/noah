import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: auth.user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });
  return Response.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: JSON.parse(m.citations || "[]") as { label: string; detail: string }[],
        createdAt: m.createdAt,
      })),
    },
  });
}
