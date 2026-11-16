"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; content: string; source: string; updatedAt: string };

export default function MemoryUI() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/memory");
    if (res.ok) setEntries((await res.json()).entries as Entry[]);
  }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/memory");
      if (res.ok) setEntries((await res.json()).entries as Entry[]);
    })();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newContent }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Could not save.");
    else {
      setNewContent("");
      setError(null);
      load();
    }
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/memory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editingText }),
    });
    if (!res.ok) setError("Could not save the change.");
    else {
      setEditingId(null);
      load();
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this memory? This cannot be undone.")) return;
    await fetch(`/api/memory/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="flex gap-2">
        <input value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Something NOAH should remember about you…"
          className="min-w-0 flex-1 rounded border px-3 py-2" />
        <button className="rounded bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700">Remember</button>
      </form>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-zinc-600">
        NOAH only remembers what you save here (or what you tap “Remember this” on in chat). Nothing is saved without you choosing it.
      </p>
      <ul className="space-y-3">
        {entries.length === 0 && <p className="text-zinc-500">No memories saved yet.</p>}
        {entries.map((en) => (
          <li key={en.id} className="rounded border bg-white p-4">
            {editingId === en.id ? (
              <div className="space-y-2">
                <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={3}
                  className="w-full rounded border px-3 py-2" />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(en.id)} className="rounded bg-zinc-900 px-3 py-1 text-sm text-white">Save</button>
                  <button onClick={() => setEditingId(null)} className="rounded border px-3 py-1 text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm">{en.content}</p>
                <p className="mt-1 text-xs text-zinc-500">From {en.source} · {new Date(en.updatedAt).toLocaleString()}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => { setEditingId(en.id); setEditingText(en.content); }} className="rounded border px-3 py-1 text-sm">Edit</button>
                  <button onClick={() => remove(en.id)} className="rounded border px-3 py-1 text-sm text-red-700">Delete</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
