import nodemailer from "nodemailer";
import { prisma } from "./db";

export type MailResult = { sent: true } | { sent: false; devLink?: string; error: string };

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<MailResult> {
  const link = `${appUrl()}/verify?token=${token}`;
  return sendMail(
    email,
    "Verify your NOAH account",
    `Welcome to NOAH.\n\nPlease verify your email address by opening this link (valid for 24 hours):\n${link}\n\nIf you did not create a NOAH account, ignore this email.`,
    link,
  );
}

export async function sendResetEmail(email: string, token: string): Promise<MailResult> {
  const link = `${appUrl()}/reset/${token}`;
  return sendMail(
    email,
    "Reset your NOAH password",
    `You asked to reset your NOAH password.\n\nOpen this link to choose a new password (valid for 30 minutes):\n${link}\n\nIf you did not ask for this, ignore this email — your password stays unchanged.`,
    link,
  );
}

async function sendMail(
  to: string,
  subject: string,
  text: string,
  devLink: string,
): Promise<MailResult> {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV === "development") {
      // Dev-only fallback: print the link to the server console so the flow can be
      // completed locally without an SMTP server. Never done in production.
      console.log(`[NOAH mail — SMTP not configured] ${subject} -> ${to}\n${devLink}`);
      return { sent: false, devLink, error: "SMTP is not configured." };
    }
    return {
      sent: false,
      error:
        "Email is not configured on this server (SMTP). Ask the administrator to set SMTP_HOST, SMTP_USER and SMTP_PASS.",
    };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "NOAH <no-reply@example.com>",
      to,
      subject,
      text,
    });
    return { sent: true };
  } catch (err) {
    console.error("[NOAH mail] send failed:", err);
    return { sent: false, error: "The email could not be sent. Please try again later." };
  }
}

export async function logAudit(userId: string, action: string, detail = ""): Promise<void> {
  await prisma.auditLog.create({ data: { userId, action, detail } });
}
