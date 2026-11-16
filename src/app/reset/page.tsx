"use client";

import Link from "next/link";
import { useState } from "react";

export default function ResetRequestPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/auth/reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    setDone(true);
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <div className="mt-6 rounded border bg-white p-5">
        {done ? (
          <p>If an account exists for {email}, a reset link has been sent. The link is valid for 30 minutes.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <button type="submit" disabled={busy}
              className="w-full rounded bg-zinc-900 py-2 text-white hover:bg-zinc-700 disabled:opacity-50">
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <p className="text-center text-sm text-zinc-600">
              <Link href="/login" className="underline">Back to login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
