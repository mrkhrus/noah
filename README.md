# NOAH — Real Multi-User Web Assistant

NOAH is Ali Noor's final-year project: an AI virtual assistant on the web. This is the
**real application** — not a demo. Multiple people can sign up, connect their own Google
accounts, and use NOAH with their own data. Nothing is simulated, faked or canned: if a
service is not configured, the app says so instead of pretending.

Implements **FR-14 Option B** from the website scope draft: FR-01 accounts, FR-02
conversation, FR-03 voice, FR-04 tasks, FR-05 sync/offline, FR-06 scope control, FR-07
permissions + audit, FR-11 memory, FR-12 notifications. Desktop (FR-08), mobile (FR-10)
and extension (FR-09) are separate clients and are out of scope here. FR-13 (offline
last-session recap) is a desktop feature and is also out of scope for the website.

## What it does

- **Real auth** — sign up with email + password (bcrypt), email verification, login with
  5-failed-attempt / 15-minute lockout, password reset (30-minute link, invalidates all
  sessions), Google sign-in, log out, log out all devices, 7-day soft delete.
- **Per-user Google accounts** — each user connects their own Google account (OAuth):
  Gmail, Calendar, Drive, Docs, Sheets. Tokens are AES-256-GCM encrypted in the database.
- **Real AI chat** — Google Gemini (free tier) answers in English, Urdu and Roman Urdu,
  with summaries, comparisons and decision help, clarifying questions, and citation lines
  for facts drawn from the user's own connected data. Without a `GEMINI_API_KEY` the chat
  says so honestly and refuses to fake an answer.
- **Tasks (FR-04)** — FIFO queue, one task at a time, pause / resume / cancel. Sending an
  email or creating a calendar event always waits for the user's explicit approval.
- **Memory (FR-11)** — per-user facts the user can review, edit and delete. Nothing is
  saved without the user choosing it.
- **Reminders & quiet hours (FR-12)** — reminders with due times; reminders due inside
  quiet hours are held.
- **Scope control (FR-06)** — the user chooses which services NOAH may use; NOAH asks
  before expanding access.
- **Voice (FR-03)** — push-to-talk input and spoken replies via the Web Speech API where
  the browser supports it (Chrome/Edge); hidden with an honest note elsewhere.
- **Offline (FR-05)** — when the browser is offline, chat messages queue on the device
  and are sent automatically on reconnect. No fake "offline mode".

## Stack

Next.js 16 (App Router, TypeScript) · Prisma 6 · SQLite for local dev, Postgres for
production · Tailwind CSS · Google Gemini · Google APIs (Gmail / Calendar / Drive) ·
bcryptjs · jose (JWT sessions in httpOnly cookies) · nodemailer.

## Run it locally

```bash
cp .env.example .env.local   # then fill in the secrets (see below)
npm install
npm run db:migrate           # creates prisma/dev.db and applies the migration
npm run dev                  # http://localhost:3000
```

Minimum to try the full flow locally: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`.
For real AI answers add `GEMINI_API_KEY`. For Google sign-in / account connection add
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (see DEPLOY.md). For real verification
emails add the `SMTP_*` settings; without SMTP, in development the verification link is
printed to the server console and returned in the signup response (dev only).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run db:migrate` | `prisma migrate dev` (local) |
| `npm run db:deploy` | `prisma migrate deploy` (production) |
| `npm run db:purge` | Permanently delete accounts soft-deleted more than 7 days ago |

## Project layout

```
prisma/schema.prisma        Database: users, tokens, connected accounts, conversations,
                            messages, tasks, memory, reminders, audit log, settings
src/lib/                    db, auth (JWT/bcrypt), crypto (token encryption),
                            google (OAuth + Gmail/Calendar/Drive), gemini (real AI),
                            scope (FR-06), tasks (FR-04 queue runner), mailer
src/app/api/                Auth, accounts, chat, conversations, tasks, memory,
                            reminders, settings, audit, account delete
src/app/                    Pages: landing, login, signup, verify, reset,
                            chat, tasks, memory, accounts, reminders, settings
src/components/             Nav, ChatUI (voice + offline outbox), TasksUI,
                            MemoryUI, AccountsUI, RemindersUI, SettingsUI
scripts/purge-deleted.ts    7-day soft-delete purge
vercel.json                 Cron: task queue runner every 5 minutes
```

## Deploy

See [DEPLOY.md](DEPLOY.md) — Vercel (free tier) + Vercel Postgres, Google Cloud OAuth
client setup, Gemini key, and the custom domain option for `alinoordhuddi.me`.

## Notes for the developer

- Never add demo accounts, sample data or canned replies. Unconfigured services must
  fail with a clear setup message.
- Prisma engine downloads: the sandbox proxy resets Node.js downloads from
  `binaries.prisma.sh`. If `prisma generate` fails with `ECONNRESET` here, download the
  three engine files with curl into `node_modules/@prisma/engines/` and set
  `PRISMA_QUERY_ENGINE_BINARY`, `PRISMA_SCHEMA_ENGINE_BINARY` and
  `PRISMA_QUERY_ENGINE_LIBRARY` in `.env` (already present in the local `.env`).
  This is a sandbox-only workaround; Vercel downloads the engines normally.
