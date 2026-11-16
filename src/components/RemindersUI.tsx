"use client";

import { useEffect, useState } from "react";

type Reminder = { id: string; title: string; dueAt: string; done: boolean };

export default function RemindersUI() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [quiet, setQuiet] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/reminders");
    if (r.ok) setReminders((await r.json()).reminders as Reminder[]);
    const s = await fetch("/api/settings");
    if (s.ok) {
      const d = await s.json();
      setQuiet({ start: d.settings?.quietHoursStart ?? null, end: d.settings?.quietHoursEnd ?? null });
    }
  }

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/reminders");
      if (r.ok) setReminders((await r.json()).reminders as Reminder[]);
      const s = await fetch("/api/settings");
      if (s.ok) {
        const d = await s.json();
        setQuiet({ start: d.settings?.quietHoursStart ?? null, end: d.settings?.quietHoursEnd ?? null });
      }
    })();
  }, []);

  function isQuiet(due: Date): boolean {
    if (!quiet.start || !quiet.end) return false;
    const toMin = (s: string) => {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + (m || 0);
    };
    const cur = due.getHours() * 60 + due.getMinutes();
    const start = toMin(quiet.start);
    const end = toMin(quiet.end);
    if (start === end) return false;
    if (start < end) return cur >= start && cur < end;
    return cur >= start || cur < end;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, dueAt: new Date(dueAt).toISOString() }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Could not create the reminder.");
    else {
      setTitle("");
      setDueAt("");
      setError(null);
      load();
    }
  }

  async function toggle(r: Reminder) {
    await fetch(`/api/reminders/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !r.done }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      {quiet.start && quiet.end && (
        <p className="rounded bg-zinc-100 px-3 py-2 text-sm">
          Quiet hours: {quiet.start} – {quiet.end}. Reminders due inside quiet hours are held and shown as held.
        </p>
      )}
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Remind me to…" required
          className="min-w-0 flex-1 rounded border px-3 py-2" />
        <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required
          className="rounded border px-3 py-2" />
        <button className="rounded bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700">Add reminder</button>
      </form>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <ul className="space-y-3">
        {reminders.length === 0 && <p className="text-zinc-500">No reminders yet.</p>}
        {reminders.map((r) => {
          const due = new Date(r.dueAt);
          const overdue = !r.done && due < new Date();
          const held = !r.done && isQuiet(due);
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-4">
              <div>
                <p className={r.done ? "line-through text-zinc-500" : "font-medium"}>{r.title}</p>
                <p className="text-sm text-zinc-600">
                  Due {due.toLocaleString()}
                  {overdue && " · overdue"}
                  {held && " · held (quiet hours)"}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggle(r)} className="rounded border px-3 py-1 text-sm">
                  {r.done ? "Undo" : "Done"}
                </button>
                <button onClick={() => remove(r.id)} className="rounded border px-3 py-1 text-sm text-red-700">Delete</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
