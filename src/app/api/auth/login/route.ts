import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) {
    return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return Response.json(
      { error: `Account locked after too many failed attempts. Try again in ${mins} minute(s).` },
      { status: 423 },
    );
  }
  if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    const attempts = user.failedLoginAttempts + 1;
    const locked = attempts >= MAX_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: locked ? 0 : attempts,
        lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
      },
    });
    return Response.json(
      {
        error: locked
          ? `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`
          : "Email or password is incorrect.",
      },
      { status: 401 },
    );
  }
  if (!user.emailVerified) {
    return Response.json(
      { error: "Please verify your email first. Check your inbox for the verification link.", needsVerification: true },
      { status: 403 },
    );
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  const token = await createSession(user.id, user.tokenVersion);
  await setSessionCookie(token);
  await logAudit(user.id, "auth.login", "Email login.");
  return Response.json({ ok: true });
}
