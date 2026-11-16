"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ScopeKey = "gmail" | "calendar" | "drive" | "docs" | "sheets";
const SCOPE_LABELS: Record<ScopeKey, string> = {
  gmail: "Gmail — read email (sending always needs your approval)",
  calendar: "Calendar — read and create events",
  drive: "Drive — list your files",
  docs: "Docs — read document text",
  sheets: "Sheets — read spreadsheet text",
};

type Audit = { id: string; action: string; detail: string; createdAt: string };

export default function SettingsUI({ email, name }: { email: string; name: string | null }) {
  const router = useRouter();
  const [timezone, setTimezone] = useState("Asia/Karachi");
  const [language, setLanguage] = useState("en");
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [scopes, setScopes] = useState<Record<ScopeKey, boolean>>({
    gmail: true,
    calendar: true,
    drive: true,
    docs: true,
    sheets: true,
  });
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const d = await res.json();
        const s = d.settings;
        if (s) {
          setTimezone(s.timezone ?? "Asia/Karachi");
          setLanguage(s.language ?? "en");
          setQuietStart(s.quietHoursStart ?? "");
          setQuietEnd(s.quietHoursEnd ?? "");
          setScopes(s.scopes);
          setVoiceEnabled(s.voiceEnabled ?? true);
        }
      }
      const a = await fetch("/api/audit");
      if (a.ok) setAudit((await a.json()).logs as Audit[]);
      setLoaded(true);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timezone,
        language,
        quietHoursStart: quietStart || null,
        quietHoursEnd: quietEnd || null,
        scopes,
        voiceEnabled,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Could not save settings.");
    else setNotice("Settings saved.");
  }

  async function logoutAll() {
    if (!confirm("Sign out on all devices, including this one?")) return;
    await fetch("/api/auth/logout-all", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function deleteAccount() {
    if (!confirm("Delete your NOAH account? It stops working immediately and is permanently removed after 7 days. This cannot be undone.")) return;
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (!res.ok) {
      setError("Could not delete the account.");
      return;
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (!loaded) return <p className="text-zinc-500">Loading settings…</p>;

  return (
    <div className="space-y-8">
      <form onSubmit={save} className="space-y-4 rounded border bg-white p-4">
        <p className="text-sm text-zinc-600">Signed in as <strong>{name ?? email}</strong> ({email})</p>
        <div>
          <label className="block text-sm font-medium">Timezone</label>
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Preferred language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
            <option value="en">English</option>
            <option value="ur">Urdu</option>
            <option value="roman">Roman Urdu</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Quiet hours start</label>
            <input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Quiet hours end</label>
            <input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} />
          Voice input and spoken replies enabled
        </label>
        <div>
          <h3 className="font-medium">What NOAH may access (scope control)</h3>
          <p className="text-sm text-zinc-600">
            NOAH stays inside the scope you set. If you ask for something outside it, NOAH asks
            before expanding access — it never silently reaches further.
          </p>
          <div className="mt-2 space-y-2">
            {(Object.keys(SCOPE_LABELS) as ScopeKey[]).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={scopes[k]} onChange={(e) => setScopes({ ...scopes, [k]: e.target.checked })} />
                {SCOPE_LABELS[k]}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {notice && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}
        <button className="rounded bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700">Save settings</button>
      </form>

      <div className="rounded border bg-white p-4">
        <h2 className="font-semibold">Sessions</h2>
        <p className="mt-1 text-sm text-zinc-600">Signed in on this device. Use “Log out all devices” to end every session at once.</p>
        <button onClick={logoutAll} className="mt-3 rounded border px-4 py-2 text-sm hover:bg-zinc-100">
          Log out all devices
        </button>
      </div>

      <div className="rounded border bg-white p-4">
        <h2 className="font-semibold">Audit log</h2>
        <p className="mt-1 text-sm text-zinc-600">Everything NOAH did for you, and everything you approved.</p>
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
          {audit.length === 0 && <li className="text-zinc-500">No recorded actions yet.</li>}
          {audit.map((a) => (
            <li key={a.id} className="border-b pb-2">
              <span className="font-mono text-xs text-zinc-500">{new Date(a.createdAt).toLocaleString()}</span>
              <span className="ml-2 font-medium">{a.action}</span>
              {a.detail && <span className="ml-2 text-zinc-600">{a.detail}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded border border-red-200 bg-white p-4">
        <h2 className="font-semibold text-red-700">Delete account</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Your account stops working immediately and is permanently deleted after 7 days.
        </p>
        <button onClick={deleteAccount} className="mt-3 rounded bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-800">
          Delete my account
        </button>
      </div>
    </div>
  );
}
