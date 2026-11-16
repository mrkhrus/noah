import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const record = await prisma.verificationToken.findUnique({
    where: { token: parsed.data.token },
  });
  if (!record || record.type !== "password_reset" || record.usedAt) {
    return Response.json({ error: "This reset link is invalid or has already been used." }, { status: 400 });
  }
  if (record.expiresAt < new Date()) {
    return Response.json({ error: "This reset link has expired (30 minutes). Request a new one." }, { status: 400 });
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        // FR-01 (restored): password reset invalidates all sessions.
        tokenVersion: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  await logAudit(record.userId, "auth.password_reset", "Password changed via reset link; all sessions invalidated.");
  return Response.json({ ok: true, message: "Password changed. You can now log in." });
}
