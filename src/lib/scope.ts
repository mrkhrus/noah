import { prisma } from "./db";

export type ScopeKey = "gmail" | "calendar" | "drive" | "docs" | "sheets";
export type ScopeMap = Record<ScopeKey, boolean>;

export const ALL_SCOPES: ScopeKey[] = ["gmail", "calendar", "drive", "docs", "sheets"];

export const SCOPE_LABELS: Record<ScopeKey, string> = {
  gmail: "Gmail (read email, send only with your approval)",
  calendar: "Google Calendar (read and create events)",
  drive: "Google Drive (list your files)",
  docs: "Google Docs (read document text)",
  sheets: "Google Sheets (read spreadsheet text)",
};

export const DEFAULT_SCOPES: ScopeMap = {
  gmail: true,
  calendar: true,
  drive: true,
  docs: true,
  sheets: true,
};

export function parseScopes(raw: string | null | undefined): ScopeMap {
  try {
    const parsed = JSON.parse(raw ?? "{}") as Partial<ScopeMap>;
    return { ...DEFAULT_SCOPES, ...parsed };
  } catch {
    return { ...DEFAULT_SCOPES };
  }
}

export async function getUserScopes(userId: string): Promise<ScopeMap> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  return parseScopes(settings?.scopes);
}

/** Quiet hours check (FR-12): returns true when `now` falls inside the user's quiet hours. */
export function isQuietHours(
  quietStart: string | null | undefined,
  quietEnd: string | null | undefined,
  now = new Date(),
): boolean {
  if (!quietStart || !quietEnd) return false;
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = toMin(quietStart);
  const end = toMin(quietEnd);
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end; // overnight window
}
