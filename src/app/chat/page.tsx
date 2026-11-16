import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ChatUI from "@/components/ChatUI";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, title: true, updatedAt: true },
  });
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Chat with NOAH</h1>
      <ChatUI initialConversations={conversations.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() }))} />
    </div>
  );
}
