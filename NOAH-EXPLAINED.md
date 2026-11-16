# NOAH — Detailed Explanation of Everything

Written 16 November 2026, for Ali Noor. This document explains the real NOAH web
application in `~/workspace/noah-app/` — what it is, how every part works, what it
costs, what still needs you, and how it goes live by 30 November 2026.

---

## 1. What NOAH is now

NOAH (Natural Online Assistant Hub) is your final-year project: an AI virtual
assistant on the web. This version is the **real application, not a demo**:

- **Multiple people can use it.** Anyone can sign up with an email + password or
  with Google, and each person gets their own private space.
- **Each user connects their own accounts.** Every user connects their own Google
  account (Gmail, Calendar, Drive, Docs, Sheets). Your data is yours; another
  user's data is invisible to you.
- **The chat really answers.** It uses Google Gemini (AI model) to answer in
  English, Urdu and Roman Urdu — no canned replies, no pretend answers. If the AI
  key is missing, the app says so honestly instead of faking it.
- **Nothing happens without your approval.** NOAH never sends an email, creates a
  calendar event, or shares anything without you approving it inside the app first.
  Every such action is written to an audit log you can read.

The earlier prototype (the card shown on 16 Nov) was rejected because it simulated
everything — fake sign-in, canned replies. This codebase replaces it completely.
None of that prototype's code is used here.

**Scope:** this app is the **website** (FR-14 Option B from your scope draft):
FR-01 accounts, FR-02 chat, FR-03 voice, FR-04 tasks, FR-05 offline/sync,
FR-06 scope control, FR-07 permissions + audit, FR-11 memory, FR-12 reminders
and quiet hours. Desktop (FR-08), mobile (FR-10) and browser extension (FR-09)
are separate clients and are **not** in this app. FR-13 (offline last-session
recap) is a desktop feature and is also not in this app.

---

## 2. The big picture — how it works

```
Your browser (phone / laptop)
        |
        |  HTTPS
        v
Next.js app (one program: web pages + API)
        |
        +---> Prisma  --->  Database (SQLite on your laptop,
        |                   Postgres when live on Vercel)
        |
        +---> Google Gemini API  (the AI that answers chats)
        |
        +---> Google APIs  (Gmail, Calendar, Drive — per user,
                            only after that user connects)
        |
        +---> SMTP email server  (verification + password-reset emails)
```

- **Frontend:** the pages you see (landing, sign up, login, chat, tasks, memory,
  accounts, reminders, settings). Built with React.
- **Backend:** API routes under `src/app/api/` — these do the real work (signing
  you in, asking Gemini, reading your Gmail, running tasks). The browser never
  talks to Gemini or Google directly; everything goes through the server, which
  is what keeps your keys and tokens secret.
- **Database:** stores users, sessions, connected accounts (tokens encrypted),
  conversations, messages, tasks, memory entries, reminders, settings, audit log.

---

## 3. Technology stack (and why each piece)

| Piece | Version | Why it is there |
|---|---|---|
| Next.js (App Router) | 16.4.6 | The web framework — pages + API in one app, easy to deploy on Vercel |
| React | 19.3.0 | Builds the user interface |
| TypeScript | 5 | Typed JavaScript — catches bugs before running |
| Prisma | 6.14.0 | Talks to the database with typed queries + migrations |
| SQLite (local) / Postgres (live) | — | SQLite file for development; Postgres for production on Vercel |
| Tailwind CSS | 4.3.3 | Styling |
| Google Gemini (`@google/generative-ai`) | 0.24.1 | The AI model that answers chats — model `gemini-3.8-flash`, free tier |
| Google APIs (`googleapis`) | 190.0.0 | Real Gmail / Calendar / Drive calls |
| bcryptjs | 3.0.3 | Password hashing (passwords are never stored in plain text) |
| jose | 6.2.17 | JWT session tokens, stored in httpOnly cookies |
| nodemailer | 10.6.0 | Sends verification + password-reset emails |
| zod | 4.6.7 | Validates data coming into the API |
| Vercel Cron | — | Runs the task queue every 5 minutes when live |

Everything is free-tier: Vercel hosting (free), Vercel Postgres (free tier),
Gemini API (free tier), Google OAuth (free). There is no paid service in the
stack.

---

## 4. Every feature, explained

### 4.1 Accounts — FR-01 (`src/app/signup`, `login`, `verify`, `reset`, `src/app/api/auth/*`, `src/lib/auth.ts`)

- **Sign up** with email + password. Passwords are hashed with bcrypt — nobody,
  not even the database admin, can read your password.
- **Email verification:** after sign-up you get a verification email with a link.
  Until you verify, you cannot use the app.
- **Login** with a lockout: 5 wrong passwords in a row locks the account for
  15 minutes (stops password guessing).
- **Password reset:** a link that works for 30 minutes only, and using it logs
  out all your other sessions.
- **Google sign-in:** log in with your Google account instead of a password.
- **Log out / log out all devices:** "log out everywhere" invalidates every
  session token you have.
- **Delete account:** deletes your account after a 7-day soft-delete window
  (a purge script, `scripts/purge-deleted.ts`, removes it permanently after
  7 days).
- Sessions are JWT tokens in httpOnly cookies — JavaScript in the browser cannot
  read them, which protects against token theft.

### 4.2 Connecting your Google accounts — FR-07 (`src/app/accounts`, `src/app/api/accounts/*`, `src/lib/google.ts`, `src/lib/crypto.ts`)

- Each user connects their **own** Google account through Google OAuth (the
  normal "Sign in with Google, allow NOAH to read Gmail…" screen).
- Scopes requested: Gmail read + send, Calendar, Drive read, Docs read, Sheets
  read. Google sign-in itself only asks for `openid email profile`.
- Google gives back access tokens. NOAH stores them in the database **encrypted
  with AES-256-GCM** (`ENCRYPTION_KEY`). If someone stole the database, the
  tokens would still be unreadable without that key.
- **Approval gates:** NOAH can read your data, but it cannot send an email,
  create a calendar event, or share anything without you pressing Approve on
  that exact action inside the app.
- **Audit log:** every consequential action (approvals, task runs, sends) is
  written to a per-user audit log with a timestamp. You can read it in
  Settings (`src/app/api/audit`).

### 4.3 Chat — FR-02 (`src/app/chat`, `src/app/api/chat`, `src/app/api/conversations/*`, `src/lib/gemini.ts`)

- You type a message; the server sends it (plus your conversation history and
  any facts NOAH is allowed to use) to Google Gemini, and streams the real
  answer back.
- **Languages:** English, Urdu, Roman Urdu.
- **What it can do:** answer questions, **summarise** (e.g. "summarise my recent
  emails"), **compare** (e.g. "compare these two options"), **help you decide**,
  and ask **clarifying questions** when your request is unclear instead of
  guessing.
- **Citations:** when an answer uses facts from your own Gmail / Calendar /
  Drive, the reply shows a citation line saying where the fact came from.
- Conversations are saved per user. You can open an old conversation and it is
  still there.
- **Honest failure:** without a `GEMINI_API_KEY`, chat returns a clear
  "not configured" error (HTTP 503). It never invents a canned answer.

### 4.4 Tasks — FR-04 (`src/app/tasks`, `src/app/api/tasks/*`, `src/lib/tasks.ts`, `vercel.json`)

- You ask NOAH to do something (e.g. "send an email to X", "create a calendar
  event"). It becomes a **task in a queue**.
- The queue is **FIFO** (first in, first out) and runs **one task at a time**.
  You can **pause, resume or cancel** any task.
- **Approval gate:** a task that sends an email or creates an event waits at
  "awaiting approval" until you approve it. Nothing runs without approval.
- When live, a Vercel Cron job calls `POST /api/tasks/run` every 5 minutes
  (protected by `CRON_SECRET`) to run approved tasks. Locally you can call the
  same endpoint yourself.

### 4.5 Memory — FR-11 (`src/app/memory`, `src/app/api/memory/*`)

- NOAH keeps per-user memory entries (facts it should remember about you).
- **Nothing is saved automatically** — entries are only saved when you choose.
- You can **review, edit and delete** any memory entry at any time.

### 4.6 Reminders + quiet hours — FR-12 (`src/app/reminders`, `src/app/api/reminders/*`)

- Create reminders with a due time.
- **Quiet hours:** reminders that fall inside your quiet hours are held and
  shown after quiet hours end.

### 4.7 Scope control — FR-06 (`src/app/settings`, `src/app/api/settings`, `src/lib/scope.ts`)

- You choose which services NOAH may use (Gmail? Calendar? Drive?).
- If NOAH needs a service you have not allowed, it **asks you first** before
  expanding what it can access.

### 4.8 Voice — FR-03 (`src/components/ChatUI.tsx`)

- Push-to-talk voice input and spoken replies, using the browser's Web Speech
  API (works in Chrome/Edge). In browsers without it, the button is hidden and
  the app says so honestly.

### 4.9 Offline — FR-05 (`src/components/ChatUI.tsx`)

- If your browser goes offline, your chat messages are **queued on your device**
  and sent automatically when you reconnect. No fake "offline mode", no lost
  messages.

---

## 5. Project layout — where everything lives

```
noah-app/
  package.json            Scripts + exact dependency versions
  .env.example            Every setting the app needs (no real secrets in it)
  README.md               Short developer readme
  DEPLOY.md               Step-by-step deployment guide (Vercel + Postgres +
                          Google OAuth + Gemini key + custom domain)
  vercel.json             Cron: task runner every 5 minutes
  prisma/
    schema.prisma         Database tables: users, sessions, tokens, connected
                          accounts, conversations, messages, tasks, memory,
                          reminders, settings, audit log
    migrations/           The database change history (init migration)
  src/lib/                The brains (server-only code)
    db.ts                 Database connection
    auth.ts               Login sessions, password checks, lockout
    crypto.ts             AES-256-GCM encryption for Google tokens
    google.ts             OAuth + real Gmail/Calendar/Drive calls
    gemini.ts             Real Gemini AI calls
    scope.ts              FR-06 permission checks
    tasks.ts              FR-04 queue runner
    mailer.ts             Verification + reset emails
  src/app/api/            The API (one folder per feature)
    auth/                 signup, login, logout, logout-all, verify,
                          resend-verify, reset-request, reset, google
    accounts/             list, connect, google callback
    chat/                 send a chat message (Gemini)
    conversations/        list / open / delete conversations
    tasks/                create / list / pause / resume / cancel / run
    memory/               create / edit / delete memory entries
    reminders/            create / edit / delete reminders
    settings/             read / update settings + scope
    audit/                read your audit log
    account/delete/       delete your account
  src/app/                The pages you see
    page.tsx              Landing page
    login, signup, verify, reset/   Auth pages
    chat, tasks, memory, accounts, reminders, settings
  src/components/         UI pieces: Nav, ChatUI (voice + offline outbox),
                          TasksUI, MemoryUI, AccountsUI, RemindersUI,
                          SettingsUI
  scripts/purge-deleted.ts  Permanently removes accounts soft-deleted > 7 days
```

---

## 6. How to run it on your own laptop

```bash
cd noah-app
cp .env.example .env.local    # then fill in the secrets (section 8)
npm install
npm run db:migrate            # creates prisma/dev.db and applies the migration
npm run dev                   # open http://localhost:3000
```

Minimum to try the whole flow locally: `DATABASE_URL`, `JWT_SECRET`,
`ENCRYPTION_KEY`. Add `GEMINI_API_KEY` for real AI answers. Add
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` for Google sign-in and account
connection. Add the `SMTP_*` settings for real emails — without them, in
development the verification link is printed to the server console and returned
in the signup response (development only, never in production).

Useful commands (`package.json` scripts):

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run db:migrate` | `prisma migrate dev` (local) |
| `npm run db:deploy` | `prisma migrate deploy` (production) |
| `npm run db:purge` | Delete accounts soft-deleted more than 7 days ago |

---

## 7. How it goes live (summary of DEPLOY.md)

1. **Push this folder to GitHub** (repo `mrkhrus/noah`, to be created).
2. **Vercel:** Add New → Project → Import the repo (Next.js preset).
3. **Database:** in the Vercel project, Storage → Create → Postgres (free tier).
   Vercel adds `DATABASE_URL` automatically. Switch Prisma to `postgresql` and
   run the production migration once (documented in DEPLOY.md).
4. **Set the environment variables** in Vercel → Settings → Environment
   Variables, then Redeploy.
5. **Google Cloud OAuth client** (section 8.2) + **Gemini key** (section 8.1).
6. **Custom domain (optional):** `noah.alinoordhuddi.me` — add it in Vercel →
   Domains, add the CNAME Vercel shows at your DNS provider, set
   `APP_URL=https://noah.alinoordhuddi.me` and update the Google redirect URIs.
7. **Check the "live" list:** open the public URL → sign up → verify → log in
   → chat with a real Gemini answer → connect Google → "summarise my recent
   emails" (cited answer) → create a send-email task → approve → run → confirm
   the email arrives → check the audit log → refresh on another device and
   confirm everything is still there.

---

## 8. What still needs you (nothing here is done yet)

### 8.1 Gemini API key — for the AI chat (free)
https://aistudio.google.com/apikey → Create API key → set `GEMINI_API_KEY`.
Without it, chat cannot answer (it says so honestly — verified).

### 8.2 Google OAuth client — for Google sign-in + account connection (free)
Google Cloud Console (https://console.cloud.google.com): create a project →
OAuth consent screen (External, app name `NOAH`) → enable Gmail, Calendar,
Drive, Docs, Sheets APIs → Credentials → OAuth client ID (Web application)
with these redirect URIs (replace with your real domain when live):

- `https://<your-domain>/api/auth/google/callback`
- `https://<your-domain>/api/accounts/google/callback`

(Local dev uses `http://localhost:3000/...` for both.) Copy the client ID and
secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### 8.3 Email (SMTP) — for verification + password-reset emails
Any SMTP server (Gmail app password, Resend, SendGrid). Set `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Without these, sign-up
cannot send verification emails in production and returns an honest error.

### 8.4 Production secrets — generate once, never share
`JWT_SECRET` (`openssl rand -base64 32`), `ENCRYPTION_KEY`
(`openssl rand -hex 32` — 64 hex characters), `CRON_SECRET`
(`openssl rand -hex 16`). The local `.env` file has clearly-marked development
placeholders only — never use those in production, and never commit any `.env`
file to GitHub (`.gitignore` already blocks `.env*`).

### 8.5 GitHub repo + deploy
Create the empty repo `mrkhrus/noah` on GitHub (public), then the code is
pushed into it, then Vercel imports it (section 7).

---

## 9. What was verified (16 Nov 2026)

- `npm run build` passes — **36 routes**; `npx eslint` clean; production
  server smoke-tested (landing/login return 200, sign-up works).
- **36 out of 36 end-to-end checks passed** against the dev server: sign up →
  verify → log in → chat returns an honest 503 without a key → memory create /
  read / update / delete → task approval gate holds the task until approved →
  task run fails honestly without a Google account → reminders → settings /
  scope → audit log → Google connect returns 503 without OAuth config →
  log out everywhere invalidates the old session → lockout after 5 wrong
  logins (423) → password reset via the dev-console link.
- **Multi-user isolation verified:** a second user sees empty memory, tasks and
  audit log, and gets a 404 when trying to open the first user's conversation.
- The database was reset to empty afterwards (0 users), so you start clean.

## 10. What was NOT verified (and why)

- **A real Gemini reply** — no API key exists yet; needs your key (8.1).
- **The live Google OAuth round-trip** — no OAuth client exists yet; needs your
  Google Cloud project (8.2). The code uses the real `googleapis` library; the
  calls themselves have not run against Google yet.
- **Real email delivery** — no SMTP server; only the development console
  fallback was verified.
- **Postgres** — only SQLite was run locally; the provider switch is documented
  in DEPLOY.md but not yet executed.
- **Vercel deploy** — not attempted yet.

## 11. Roadmap to 30 November 2026

| Step | Status |
|---|---|
| Real multi-user codebase (this app) | Done + verified, 16 Nov |
| GitHub repo `mrkhrus/noah` | To create (GitHub app cannot create repos — you create the empty one, or I do it in the browser) |
| Push code to the repo | Right after the repo exists |
| Vercel project + Postgres | After the push |
| Gemini key + Google OAuth client + SMTP | Needs you (section 8) |
| Live URL test of the full "live" checklist | After deploy + keys |
| RogueVision Films reply on FR-13 / FR-14 | Chase sent 16 Nov; still waiting — revise the app to whatever they confirm |
| Website live | Target: 30 Nov 2026 |

---

## 12. One honest note

This is a real, working application — but it is version 1 of the website, built
from the FR-14 Option B draft. It has not been reviewed or approved by
RogueVision Films, and the live Google / Gemini paths have not run with real
keys yet. The next steps are: get it on GitHub, deploy it, add your keys, and
test the full flow live. If RogueVision asks for changes, the code is organised
so each feature (auth, chat, tasks, memory, accounts) can change on its own.
