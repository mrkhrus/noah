import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/mailer";
import { ALL_SCOPES, parseScopes } from "@/lib/scope";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const settings = await prisma.userSettings.findUnique({ where: { userId: auth.user.id } });
  return Response.json({
    settings: settings
      ? {
          timezone: settings.timezone,
          language: settings.language,
          quietHoursStart: settings.quietHoursStart,
          quietHoursEnd: settings.quietHoursEnd,
          scopes: parseScopes(settings.scopes),
          voiceEnabled: settings.voiceEnabled,
        }
      : null,
    user: { email: auth.user.email, name: auth.user.name },
  });
}

const bodySchema = z.object({
  timezone: z.string().max(100).optional(),
  language: z.enum(["en", "ur", "roman"]).optional(),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  scopes: z
    .record(z.string(), z.boolean())
    .optional(),
  voiceEnabled: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const current = await prisma.userSettings.findUnique({ where: { userId: auth.user.id } });
  const mergedScopes = parsed.data.scopes
    ? { ...parseScopes(current?.scopes), ...parsed.data.scopes }
    : parseScopes(current?.scopes);
  const unknown = Object.keys(mergedScopes).filter((k) => !(ALL_SCOPES as string[]).includes(k));
  if (unknown.length > 0) {
    return Response.json({ error: `Unknown scope: ${unknown.join(", ")}` }, { status: 400 });
  }
  const updated = await prisma.userSettings.upsert({
    where: { userId: auth.user.id },
    update: {
      timezone: parsed.data.timezone,
      language: parsed.data.language,
      quietHoursStart: parsed.data.quietHoursStart,
      quietHoursEnd: parsed.data.quietHoursEnd,
      scopes: JSON.stringify(mergedScopes),
      voiceEnabled: parsed.data.voiceEnabled,
    },
    create: {
      userId: auth.user.id,
      timezone: parsed.data.timezone ?? "Asia/Karachi",
      language: parsed.data.language ?? "en",
      quietHoursStart: parsed.data.quietHoursStart ?? null,
      quietHoursEnd: parsed.data.quietHoursEnd ?? null,
      scopes: JSON.stringify(mergedScopes),
      voiceEnabled: parsed.data.voiceEnabled ?? true,
    },
  });
  await logAudit(auth.user.id, "settings.updated", "Preferences and scope settings updated.");
  return Response.json({ settings: { ...updated, scopes: parseScopes(updated.scopes) } });
}
