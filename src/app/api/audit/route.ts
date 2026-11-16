import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// FR-07: audit records — what NOAH did, and what you approved.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const logs = await prisma.auditLog.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, action: true, detail: true, createdAt: true },
  });
  return Response.json({ logs });
}
