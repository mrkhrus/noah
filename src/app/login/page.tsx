"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in is not configured on this server yet.",
  google_cancelled: "Google sign-in was cancelled.",
  google_failed: "Google sign-in failed. Please try again.",
  google_no_email: "Google did not return an email address.",
  account_deleted: "This account is scheduled for deletion.",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") ? GOOGLE_ERRORS[params.get("error") as string] ?? "Sign-in failed." : null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Login failed.");
      setNeedsVerification(Boolean(data.needsVerification));
      return;
    }
    router.push("/chat");
    router.refresh();
  }

  async function resend() {
    const res = await fetch("/api/auth/resend-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setNotice(data.message ?? "Verification link sent.");
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-bold">Log in to NOAH</h1>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded border bg-white p-5">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {notice && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}
        {needsVerification && (
          <button type="button" onClick={resend} className="text-sm text-blue-700 underline">
            Resend verification email
          </button>
        )}
        <button type="submit" disabled={busy}
          className="w-full rounded bg-zinc-900 py-2 text-white hover:bg-zinc-700 disabled:opacity-50">
          {busy ? "Logging in…" : "Log in"}
        </button>
        <a href="/api/auth/google"
          className="block rounded border py-2 text-center hover:bg-zinc-100">
          Continue with Google
        </a>
        <p className="text-center text-sm text-zinc-600">
          <Link href="/reset" className="underline">Forgot password?</Link>
          {" · "}
          <Link href="/signup" className="underline">Create an account</Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
