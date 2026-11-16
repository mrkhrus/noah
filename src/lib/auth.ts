import bcrypt from "bcryptjs";
import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";

export const SESSION_COOKIE = "noah_session";
const SESSION_DAYS = 7;

function jwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET ?? "";
  if (s.length < 16) {
    throw new Error("JWT_SECRET is not configured. Set a long random secret.");
  }
  return new TextEncoder().encode(s);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, tokenVersion: number): Promise<string> {
  return new SignJWT({ sub: userId, tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(jwtSecret());
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: Date | null;
  tokenVersion: number;
};

/** Returns the logged-in user, or null. Invalidates sessions whose tokenVersion no longer matches (FR-01: log out all devices / password reset). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    const userId = payload.sub as string;
    const tv = payload.tv as number;
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) return null;
    if (user.tokenVersion !== tv) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      tokenVersion: user.tokenVersion,
    };
  } catch {
    return null;
  }
}

/** For API routes: returns the user or a 401 Response. */
export async function requireUser(): Promise<
  { user: SessionUser } | { response: Response }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      response: Response.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  return { user };
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}
