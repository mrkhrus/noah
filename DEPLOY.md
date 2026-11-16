# Deploying NOAH

Target: live at a public URL by **30 November 2026** (FR-14 "live" checklist: public URL;
register / verify / log in; text chat with cited answers; approval before consequential
actions; conversations and preferences persist).

## 1. Vercel project (free tier)

1. Push this folder to a GitHub repository (e.g. `mrkhrus/noah-app`).
2. In Vercel: **Add New → Project → Import** the repository. Framework preset: Next.js.
3. Build command: `npm run build` (runs `prisma generate` first). Output: default.
4. Set the environment variables below in **Settings → Environment Variables**
   (Production + Preview as needed), then **Redeploy**.

## 2. Database — Vercel Postgres (free tier)

1. In the Vercel project: **Storage → Create → Postgres** (free tier).
2. Vercel adds `DATABASE_URL` (and pooled variants) to the project automatically.
3. Switch the Prisma provider for production: in `prisma/schema.prisma` change
   `provider = "sqlite"` to `provider = "postgresql"`, then create a migration for
   Postgres (`npx prisma migrate dev --name postgres` against a Postgres database)
   and deploy with `npx prisma migrate deploy` (Vercel runs `npm run build`; run the
   migrate once from your machine with the production `DATABASE_URL`, or add a
   `vercel.json` build step — the manual one-time migrate is the simplest honest path).
   > Keep the SQLite provider in the repo for local dev; the Postgres migration is a
   > deployment-time change, documented here so it is never a silent surprise.

## 3. Environment variables

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Vercel Postgres (auto) locally `file:./dev.db` |
| `APP_URL` | The public URL, e.g. `https://noah-app.vercel.app` (or the custom domain). Used for OAuth redirects and email links — must match exactly. |
| `JWT_SECRET` | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` (64 hex chars) — encrypts stored Google OAuth tokens |
| `GEMINI_API_KEY` | Free key at https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | `gemini-3.8-flash` (default) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth client (step 4) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Any SMTP server (e.g. Gmail app password, Resend, SendGrid). Without these, sign-up cannot send verification emails in production and returns an honest error. |
| `CRON_SECRET` | `openssl rand -hex 16` — protects `/api/tasks/run` (Vercel Cron sends it automatically) |

## 4. Google Cloud OAuth client

1. https://console.cloud.google.com → create/select a project → **APIs & Services →
   OAuth consent screen**: User type **External**, fill the app name (`NOAH`), support
   email, and developer contact. Add the scopes NOAH requests (Gmail readonly + send,
   Calendar, Drive readonly, Docs readonly, Sheets readonly) under **Data Access**.
   For a final-year demo, test users can be added; for public use, publish the app.
2. **APIs & Services → Library**: enable **Gmail API**, **Google Calendar API**,
   **Google Drive API**, **Google Docs API**, **Google Sheets API**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID →
   Web application**. Add both redirect URIs (sign-in and per-user connection):
   - `https://<your-domain>/api/auth/google/callback`
   - `https://<your-domain>/api/accounts/google/callback`
   (For local dev, use `http://localhost:3000/...` for both.)
4. Copy the client ID and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. **Google sign-in** uses only `openid email profile`. **Connecting an account**
   requests the Gmail/Calendar/Drive/Docs/Sheets scopes listed above; each user
   connects their own account, and tokens are stored encrypted.

## 5. Gemini API key

1. https://aistudio.google.com/apikey → **Create API key** (free tier).
2. Set `GEMINI_API_KEY`. Without it, chat returns a clear "not configured" message and
   never pretends to answer.

## 6. Custom domain — alinoordhuddi.me (optional)

1. In Vercel: **Settings → Domains → Add** `noah.alinoordhuddi.me` (recommended
   subdomain; the root domain already serves the portfolio).
2. At the DNS provider for `alinoordhuddi.me`, add the `CNAME` record Vercel shows
   (`noah` → `cname.vercel-dns.com`).
3. Set `APP_URL=https://noah.alinoordhuddi.me` and update the two Google redirect URIs
   in the Cloud Console to the same domain.

## 7. Verify the "live" checklist

1. Open the public URL → sign up → verify email → log in → log out.
2. Log in → chat: ask a general question (real Gemini answer) and, after connecting
   a Google account, "summarise my recent emails" (cited answer).
3. Create a task of type "Send an email" → approve it → run it → confirm the email
   arrives; check the audit log in Settings.
4. Refresh / log in on another device → conversations and preferences persist.

## 8. Ongoing jobs

- **Task queue runner**: `vercel.json` runs `/api/tasks/run` every 5 minutes via
  Vercel Cron (free tier allows this). It only runs tasks the user approved.
- **Soft-delete purge**: accounts deleted in-app are purged after 7 days by
  `npm run db:purge` — run it manually or add a weekly cron that calls it.
