"use client";

import { useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  type: string;
  payload: string;
  status: string;
  needsApproval: boolean;
  approvalStatus: string;
  result: string | null;
  error: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  summary: "Summarise inbox & calendar (read-only)",
  email_send: "Send an email (needs approval)",
  email_draft: "Create an email draft",
  calendar_create: "Create a calendar event (needs approval)",
};

export default function TasksUI() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("summary");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/tasks");
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks as Task[]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: Record<string, string> = {};
    if (type === "email_send" || type === "email_draft") {
      payload.to = to;
      payload.subject = subject;
      payload.body = body;
    }
    if (type === "calendar_create") {
      payload.title = title;
      payload.start = new Date(eventStart).toISOString();
      payload.end = new Date(eventEnd).toISOString();
    }
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, type, payload }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create the task.");
      return;
    }
    setTitle("");
    setTo("");
    setSubject("");
    setBody("");
    setEventStart("");
    setEventEnd("");
    setNotice("Task created and queued. It runs one at a time, in order.");
    load();
  }

  async function action(id: string, action: string) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Action failed.");
    else setNotice(`Task ${action}d.`);
    load();
  }

  async function runNext() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/tasks/run", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(data.error ?? "Could not run the task.");
    else setNotice(data.message ?? "Done.");
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-semibold">Create a task</h2>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title"
          className="w-full rounded border px-3 py-2" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded border px-3 py-2">
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {(type === "email_send" || type === "email_draft") && (
          <>
            <input required value={to} onChange={(e) => setTo(e.target.value)} placeholder="To (email address)"
              className="w-full rounded border px-3 py-2" />
            <input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
              className="w-full rounded border px-3 py-2" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Email body" rows={3}
              className="w-full rounded border px-3 py-2" />
          </>
        )}
        {type === "calendar_create" && (
          <>
            <label className="block text-sm">Start <input type="datetime-local" required value={eventStart}
              onChange={(e) => setEventStart(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" /></label>
            <label className="block text-sm">End <input type="datetime-local" required value={eventEnd}
              onChange={(e) => setEventEnd(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" /></label>
          </>
        )}
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {notice && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}
        <button type="submit" disabled={busy} className="rounded bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700 disabled:opacity-50">
          Add to queue
        </button>
      </form>

      <div className="flex items-center gap-3">
        <button onClick={runNext} disabled={busy} className="rounded border bg-white px-4 py-2 hover:bg-zinc-100 disabled:opacity-50">
          Run next queued task
        </button>
        <p className="text-sm text-zinc-500">Tasks run one at a time, oldest first. Sending email and creating events always need your approval first.</p>
      </div>

      <ul className="space-y-3">
        {tasks.length === 0 && <p className="text-zinc-500">No tasks yet.</p>}
        {tasks.map((t) => (
          <li key={t.id} className="rounded border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{t.title}</p>
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs">{t.status}{t.needsApproval ? ` · approval: ${t.approvalStatus}` : ""}</span>
            </div>
            <p className="mt-1 text-sm text-zinc-600">{TYPE_LABELS[t.type] ?? t.type}</p>
            {t.result && <p className="mt-2 whitespace-pre-wrap text-sm">{t.result}</p>}
            {t.error && <p className="mt-2 text-sm text-red-700">{t.error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {t.needsApproval && t.approvalStatus === "pending" && t.status !== "cancelled" && t.status !== "done" && (
                <>
                  <button onClick={() => action(t.id, "approve")} className="rounded bg-green-700 px-3 py-1 text-sm text-white">Approve</button>
                  <button onClick={() => action(t.id, "reject")} className="rounded bg-red-700 px-3 py-1 text-sm text-white">Reject</button>
                </>
              )}
              {(t.status === "queued" || t.status === "running") && (
                <button onClick={() => action(t.id, "pause")} className="rounded border px-3 py-1 text-sm">Pause</button>
              )}
              {t.status === "paused" && (
                <button onClick={() => action(t.id, "resume")} className="rounded border px-3 py-1 text-sm">Resume</button>
              )}
              {t.status !== "done" && t.status !== "cancelled" && (
                <button onClick={() => action(t.id, "cancel")} className="rounded border px-3 py-1 text-sm">Cancel</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
