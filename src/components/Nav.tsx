"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Nav({
  user,
}: {
  user: { email: string; name: string | null } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
        <Link href={user ? "/chat" : "/"} className="text-xl font-bold tracking-tight">
          NOAH
        </Link>
        {user ? (
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/chat" className="hover:underline">Chat</Link>
            <Link href="/tasks" className="hover:underline">Tasks</Link>
            <Link href="/memory" className="hover:underline">Memory</Link>
            <Link href="/reminders" className="hover:underline">Reminders</Link>
            <Link href="/accounts" className="hover:underline">Accounts</Link>
            <Link href="/settings" className="hover:underline">Settings</Link>
            <span className="hidden text-zinc-500 sm:inline">{user.name ?? user.email}</span>
            <button
              onClick={logout}
              disabled={busy}
              className="rounded border px-2 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50"
            >
              Log out
            </button>
          </nav>
        ) : (
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/login" className="hover:underline">Log in</Link>
            <Link href="/signup" className="rounded bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700">
              Sign up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
