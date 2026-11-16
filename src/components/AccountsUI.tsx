"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Account = { id: string; provider: string; providerEmail: string; scopes: string; createdAt: string };

function AccountsUIInner() {
  const params = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(
    params.get("error") ? "Connecting your Google account failed. Please try again." : null,
  );
  const [notice, setNotice] = useState<string | null>(
    params.get("connected") === "1"
      ? "Google account connected. NOAH can now read your Gmail, Calendar and Drive — and still asks before doing anything with them."
      : null,
  );

  async function load() {
    const res = await fetch("/api/accounts");
    if (res.ok) setAccounts((await res.json()).accounts as Account[]);
  }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/accounts");
      if (res.ok) setAccounts((await res.json()).accounts as Account[]);
    })();
  }, []);

  async function disconnect(id: string, email: string) {
    if (!confirm(`Disconnect ${email}? NOAH will no longer be able to read its email, calendar or files.`)) return;
    const res = await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) setError("Could not disconnect the account.");
    else {
      setNotice(`${email} disconnected.`);
      load();
    }
  }

  return (
    <div className="space-y-6">
      {notice && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="rounded border bg-white p-4">
        <h2 className="font-semibold">Connect your Google account</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Connecting lets NOAH read your Gmail, Calendar, Drive, Docs and Sheets so it can answer
          questions about them with citations. NOAH never sends, creates or shares anything without
          your explicit approval, and your tokens are stored encrypted. Each person connects their
          own account — nobody else can see your data.
        </p>
        <a href="/api/accounts/connect" className="mt-3 inline-block rounded bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700">
          Connect Google account
        </a>
      </div>
      <div>
        <h2 className="font-semibold">Connected accounts</h2>
        {accounts.length === 0 && <p className="mt-2 text-sm text-zinc-500">No Google account connected yet.</p>}
        <ul className="mt-2 space-y-3">
          {accounts.map((a) => (
            <li key={a.id} className="rounded border bg-white p-4">
              <p className="font-medium">{a.providerEmail}</p>
              <p className="mt-1 text-xs text-zinc-600">Scopes: {a.scopes.split(" ").map((s) => s.split("/").pop()).join(", ")}</p>
              <p className="text-xs text-zinc-500">Connected {new Date(a.createdAt).toLocaleString()}</p>
              <button onClick={() => disconnect(a.id, a.providerEmail)}
                className="mt-2 rounded border px-3 py-1 text-sm text-red-700">
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function AccountsUI() {
  return (
    <Suspense>
      <AccountsUIInner />
    </Suspense>
  );
}
