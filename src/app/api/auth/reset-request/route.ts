import { z } from "zod";
import { prisma } from "@/lib/db";
import { randomToken } from "@/lib/auth";
import { sendResetEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user && !user.deletedAt && user.passwordHash) {
    const token = randomToken();
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        token,
        type: "password_reset",
        // FR-01 (restored): reset links are valid for 30 minutes.
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    await sendResetEmail(user.email, token);
  }
  // Same response either way so account existence is not leaked.
  return Response.json({ ok: true, message: "If an account exists for this email, a reset link has been sent." });
}
