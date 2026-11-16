import { z } from "zod";
import { prisma } from "@/lib/db";
import { randomToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// Re-send the email verification link for an unverified account.
export async function POST(req: Request) {
  const parsed = z.object({ email: z.string().email() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.deletedAt || user.emailVerified) {
    // Always return the same message so account existence is not leaked.
    return Response.json({ ok: true, message: "If the account exists and is unverified, a new link has been sent." });
  }
  const token = randomToken();
  await prisma.verificationToken.create({
    data: { userId: user.id, token, type: "email_verify", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  await sendVerificationEmail(user.email, token);
  return Response.json({ ok: true, message: "If the account exists and is unverified, a new link has been sent." });
}
