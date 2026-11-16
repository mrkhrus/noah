"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function VerifyForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"working" | "ok" | "error">(token ? "working" : "error");
  const [message, setMessage] = useState(token ? "" : "No verification token in this link.");

  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, ...d })))
      .then((d) => {
        setState(d.ok ? "ok" : "error");
        setMessage(d.message ?? d.error ?? "Verification failed.");
      })
      .catch(() => {
        setState("error");
        setMessage("Verification failed. Please try again.");
      });
  }, [token]);

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-bold">Email verification</h1>
      <div className="mt-6 rounded border bg-white p-5">
        {state === "working" && <p>Verifying your email…</p>}
        {state === "ok" && (
          <>
            <p className="text-green-700">{message}</p>
            <p className="mt-3 text-sm">
              <Link href="/login" className="underline">Log in now</Link>
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <p className="text-red-700">{message}</p>
            <p className="mt-3 text-sm text-zinc-600">
              <Link href="/login" className="underline">Back to login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
