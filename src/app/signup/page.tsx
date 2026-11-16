"use client";

import Link from "next/link";
import { useState } from "react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; devLink?: string; emailError?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Sign-up failed.");
      return;
    }
    setDone({ message: data.message, devLink: data.devLink, emailError: data.error });
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md py-10">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <div className="mt-6 space-y-3 rounded border bg-white p-5">
          <p>{done.message}</p>
          {done.emailError && <p className="text-sm text-amber-700">{done.emailError}</p>}
          {done.devLink && (
            <p className="text-sm">
              Development mode (no SMTP configured) — your verification link:
              <br />
              <a href={done.devLink} className="break-all text-blue-700 underline">{done.devLink}</a>
            </p>
          )}
          <p className="text-sm text-zinc-600">
            <Link href="/login" className="underline">Go to login</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-bold">Create your NOAH account</h1>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded border bg-white p-5">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Password (at least 8 characters)</label>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy}
          className="w-full rounded bg-zinc-900 py-2 text-white hover:bg-zinc-700 disabled:opacity-50">
          {busy ? "Creating account…" : "Sign up"}
        </button>
        <a href="/api/auth/google"
          className="block rounded border py-2 text-center hover:bg-zinc-100">
          Continue with Google
        </a>
        <p className="text-center text-sm text-zinc-600">
          Already have an account? <Link href="/login" className="underline">Log in</Link>
        </p>
      </form>
    </div>
  );
}
