import { z } from "zod";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ token: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid verification link." }, { status: 400 });
  }
  const record = await prisma.verificationToken.findUnique({
    where: { token: parsed.data.token },
    include: { user: true },
  });
  if (!record || record.type !== "email_verify" || record.usedAt) {
    return Response.json({ error: "This verification link is invalid or has already been used." }, { status: 400 });
  }
  if (record.expiresAt < new Date()) {
    return Response.json({ error: "This verification link has expired. Request a new one from the login page." }, { status: 400 });
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  return Response.json({ ok: true, message: "Email verified. You can now log in." });
}
