import { google, gmail_v1, calendar_v3, drive_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "./db";
import { decrypt, encrypt } from "./crypto";

/** Scopes requested when a user signs in with Google (identity only). */
export const SIGNIN_SCOPES = ["openid", "email", "profile"];

/** Scopes requested when a user connects their Google account to NOAH (FR-07).
 * Read scopes for Gmail/Calendar/Drive/Docs/Sheets, plus gmail.send and calendar
 * write — both are only ever used after the user's explicit in-app approval. */
export const CONNECT_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function getOAuthClient(redirectPath: string): OAuth2Client {
  if (!googleOAuthConfigured()) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see DEPLOY.md).",
    );
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl()}${redirectPath}`,
  );
}

export function getAuthUrl(kind: "signin" | "connect"): string {
  const redirectPath =
    kind === "signin" ? "/api/auth/google/callback" : "/api/accounts/google/callback";
  const client = getOAuthClient(redirectPath);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: kind === "signin" ? SIGNIN_SCOPES : CONNECT_SCOPES,
  });
}

export type GoogleTokens = {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
};

/** Loads the user's connected Google account, refreshes the access token if needed, and returns an authorised client. Returns null when no account is connected. */
export async function getConnectedGoogleClient(
  userId: string,
): Promise<{ client: OAuth2Client; accountEmail: string; scopes: string[] } | null> {
  const account = await prisma.connectedAccount.findFirst({
    where: { userId, provider: "google" },
    orderBy: { createdAt: "desc" },
  });
  if (!account) return null;
  const client = getOAuthClient("/api/accounts/google/callback");
  const tokens: GoogleTokens = {
    access_token: decrypt(account.accessTokenEnc),
    refresh_token: account.refreshTokenEnc ? decrypt(account.refreshTokenEnc) : null,
    expiry_date: account.tokenExpiry ? account.tokenExpiry.getTime() : null,
  };
  client.setCredentials(tokens);
  // Refresh if expired (or about to expire).
  if (!tokens.access_token || (tokens.expiry_date && tokens.expiry_date < Date.now() + 60_000)) {
    if (!tokens.refresh_token) {
      throw new Error(
        "Your Google connection has expired and has no refresh token. Please reconnect your Google account in Accounts.",
      );
    }
    const refreshed = await client.refreshAccessToken();
    const creds = refreshed.credentials;
    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        accessTokenEnc: encrypt(creds.access_token ?? ""),
        refreshTokenEnc: creds.refresh_token
          ? encrypt(creds.refresh_token)
          : account.refreshTokenEnc,
        tokenExpiry: creds.expiry_date ? new Date(creds.expiry_date) : null,
      },
    });
    client.setCredentials(creds);
  }
  return {
    client,
    accountEmail: account.providerEmail,
    scopes: account.scopes.split(" ").filter(Boolean),
  };
}

export type RetrievedSource = {
  label: string;
  detail: string;
};

/** Recent Gmail messages (subject / sender / date / snippet). Read-only. */
export async function searchGmail(
  client: OAuth2Client,
  query: string,
  maxResults = 5,
): Promise<RetrievedSource[]> {
  const gmail = google.gmail({ version: "v1", auth: client });
  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });
  const out: RetrievedSource[] = [];
  for (const m of list.data.messages ?? []) {
    if (!m.id) continue;
    const full = await gmail.users.messages.get({
      userId: "me",
      id: m.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    });
    const headers = Object.fromEntries(
      (full.data.payload?.headers ?? []).map((h) => [h.name ?? "", h.value ?? ""]),
    );
    out.push({
      label: `Gmail: ${headers.Subject ?? "(no subject)"}`,
      detail: `From ${headers.From ?? "unknown"} on ${headers.Date ?? "unknown"}. Snippet: ${full.data.snippet ?? ""}`,
    });
  }
  return out;
}

/** Upcoming Calendar events. Read-only. */
export async function upcomingCalendar(
  client: OAuth2Client,
  maxResults = 5,
): Promise<RetrievedSource[]> {
  const calendar = google.calendar({ version: "v3", auth: client });
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });
  return (res.data.items ?? []).map((e) => ({
    label: `Calendar: ${e.summary ?? "(no title)"}`,
    detail: `Starts ${e.start?.dateTime ?? e.start?.date ?? "unknown"}${e.location ? ` at ${e.location}` : ""}.`,
  }));
}

/** Recently modified Drive files. Read-only. */
export async function recentDriveFiles(
  client: OAuth2Client,
  maxResults = 5,
): Promise<RetrievedSource[]> {
  const drive = google.drive({ version: "v3", auth: client });
  const res = await drive.files.list({
    pageSize: maxResults,
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime)",
  });
  return (res.data.files ?? []).map((f) => ({
    label: `Drive: ${f.name ?? "(no name)"}`,
    detail: `Type ${f.mimeType ?? "unknown"}, modified ${f.modifiedTime ?? "unknown"}.`,
  }));
}

/** Reads the text of a Google Doc or Sheet (exported as plain text). Read-only. */
export async function readDriveFileText(
  client: OAuth2Client,
  fileId: string,
  mimeType: string,
): Promise<string> {
  const drive = google.drive({ version: "v3", auth: client });
  const exportMime =
    mimeType === "application/vnd.google-apps.spreadsheet"
      ? "text/csv"
      : "text/plain";
  const res = await drive.files.export(
    { fileId, mimeType: exportMime },
    { responseType: "text" },
  );
  const text = typeof res.data === "string" ? res.data : "";
  return text.slice(0, 8000);
}

/** Sends an email through the user's own Gmail account. Only called after explicit approval (FR-07). */
export async function sendGmail(
  client: OAuth2Client,
  to: string,
  subject: string,
  body: string,
): Promise<string> {
  const gmail = google.gmail({ version: "v1", auth: client });
  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`,
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return res.data.id ?? "";
}

/** Creates a Gmail draft (no sending). */
export async function createGmailDraft(
  client: OAuth2Client,
  to: string,
  subject: string,
  body: string,
): Promise<string> {
  const gmail = google.gmail({ version: "v1", auth: client });
  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`,
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });
  return res.data.id ?? "";
}

/** Creates a Calendar event. Only called after explicit approval (FR-07). */
export async function createCalendarEvent(
  client: OAuth2Client,
  title: string,
  start: string,
  end: string,
  description?: string,
): Promise<string> {
  const calendar = google.calendar({ version: "v3", auth: client });
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: title,
      start: { dateTime: start },
      end: { dateTime: end },
      description,
    },
  });
  return res.data.id ?? "";
}

export type { gmail_v1, calendar_v3, drive_v3 };
