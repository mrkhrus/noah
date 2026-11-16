import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, randomToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.deletedAt) {
    return Response.json({ error: "An account with this email already exists. Try logging in." }, { status: 409 });
  }
  if (existing?.deletedAt) {
    return Response.json(
      { error: "This email belongs to an account scheduled for deletion. It can be reused after the 7-day window." },
      { status: 409 },
    );
  }
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      settings: { create: {} },
    },
  });
  const token = randomToken();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      token,
      type: "email_verify",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const mail = await sendVerificationEmail(email, token);
  return Response.json(
    {
      ok: true,
      emailSent: mail.sent,
      error: mail.sent ? undefined : mail.error,
      // Dev only: when no SMTP is configured locally, the verification link is returned
      // so the flow can be completed. Never present in production.
      devLink: "devLink" in mail ? mail.devLink : undefined,
      message: mail.sent
        ? "Account created. Check your email for the verification link."
        : "Account created, but the verification email could not be sent.",
    },
    { status: 201 },
  );
}
