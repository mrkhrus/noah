"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Citation = { label: string; detail: string };
type ChatMessage = { id: string; role: string; content: string; citations: Citation[] };
type Conversation = { id: string; title: string; updatedAt: string };

// Web Speech API (not in TS DOM lib for all browsers).
type SpeechRecognitionType = {
  new (): {
    lang: string;
    interimResults: boolean;
    onresult: ((e: { results: { transcript: string }[][] }) => void) | null;
    onerror: ((e: unknown) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
  };
};

const OUTBOX_KEY = "noah_outbox";

type OutboxItem = { conversationId: string | null; message: string };

function loadOutbox(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]") as OutboxItem[];
  } catch {
    return [];
  }
}

export default function ChatUI({ initialConversations }: { initialConversations: Conversation[] }) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [outboxCount, setOutboxCount] = useState(() => loadOutbox().length);
  const [savedMemory, setSavedMemory] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const speechSupported =
    typeof window !== "undefined" &&
    Boolean(
      (window as unknown as { SpeechRecognition?: SpeechRecognitionType; webkitSpeechRecognition?: SpeechRecognitionType })
        .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionType }).webkitSpeechRecognition,
    );

  const loadMessages = useCallback(async (id: string): Promise<ChatMessage[]> => {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return [];
    const data = await res.json();
    const msgs = data.conversation.messages as ChatMessage[];
    setMessages(msgs);
    return msgs;
  }, []);

  useEffect(() => {
    if (!activeId) return;
    (async () => {
      const res = await fetch(`/api/conversations/${activeId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.conversation.messages as ChatMessage[]);
    })();
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string, conversationId: string | null): Promise<string | null> {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, conversationId: conversationId ?? undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Chat failed.");
    return data.conversationId as string;
  }

  const flushOutbox = useCallback(async () => {
    const items = loadOutbox();
    if (items.length === 0) return;
    for (const item of items) {
      try {
        const newId = await sendMessage(item.message, item.conversationId);
        if (!newId) continue;
        const rest = loadOutbox().filter((o) => o !== item);
        localStorage.setItem(OUTBOX_KEY, JSON.stringify(rest));
        setOutboxCount(rest.length);
        setActiveId(newId);
        await loadMessages(newId);
      } catch {
        break; // stay queued; will retry on next reconnect
      }
    }
  }, [loadMessages]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void flushOutbox();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flushOutbox]);

  function speak(text: string) {
    if (!speakReplies || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utter);
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);
    // FR-05 offline handling: queue the message locally and send it when back online.
    if (!online) {
      const outbox = loadOutbox();
      outbox.push({ conversationId: activeId, message: text });
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
      setOutboxCount(outbox.length);
      setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: text, citations: [] }]);
      return;
    }
    setSending(true);
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: text, citations: [] }]);
    try {
      const newId = await sendMessage(text, activeId);
      if (!newId) throw new Error("Chat failed: no conversation was created.");
      if (newId !== activeId) {
        setActiveId(newId);
        const res = await fetch("/api/conversations");
        const data = await res.json().catch(() => ({}));
        if (data.conversations) setConversations(data.conversations as Conversation[]);
      }
      const msgs = await loadMessages(newId);
      const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
      if (lastAssistant) speak(lastAssistant.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed. Please try again.");
      // Keep the user's message visible; remove nothing, just report the failure honestly.
    } finally {
      setSending(false);
    }
  }

  function startListening() {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionType;
      webkitSpeechRecognition?: SpeechRecognitionType;
    };
    const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  async function remember(content: string) {
    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 500) }),
    });
    if (res.ok) setSavedMemory("Saved to memory.");
    else setSavedMemory("Could not save to memory.");
    setTimeout(() => setSavedMemory(null), 3000);
  }

  function newConversation() {
    setActiveId(null);
    setMessages([]);
    setInput("");
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <aside className="w-full shrink-0 md:w-56">
        <button onClick={newConversation} className="w-full rounded bg-zinc-900 py-2 text-sm text-white hover:bg-zinc-700">
          + New conversation
        </button>
        <ul className="mt-3 space-y-1">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActiveId(c.id)}
                className={`w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-200 ${
                  c.id === activeId ? "bg-zinc-200 font-medium" : ""
                }`}
              >
                {c.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col rounded border bg-white">
        {!online && (
          <div className="rounded-t border-b bg-amber-50 px-4 py-2 text-sm text-amber-800">
            You are offline. Messages will be queued on this device and sent when you reconnect.
            {outboxCount > 0 && ` (${outboxCount} queued)`}
          </div>
        )}
        {online && outboxCount > 0 && (
          <div className="rounded-t border-b bg-blue-50 px-4 py-2 text-sm text-blue-800">
            {outboxCount} queued message(s) waiting to send…
          </div>
        )}
        <div className="flex h-[55vh] flex-col gap-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="text-zinc-500">
              Ask NOAH anything — in English, Urdu or Roman Urdu. Try “Summarise my recent emails” or
              “What is on my calendar this week?” (connect your Google account in Accounts first).
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
              m.role === "user" ? "self-end bg-zinc-900 text-white" : "self-start bg-zinc-100"
            }`}>
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.role === "assistant" && m.citations.length > 0 && (
                <div className="mt-2 border-t border-zinc-200 pt-2 text-xs text-zinc-600">
                  <p className="font-medium">Sources:</p>
                  {m.citations.map((c, i) => (
                    <p key={i}>• {c.label} — {c.detail}</p>
                  ))}
                </div>
              )}
              {m.role === "assistant" && (
                <button onClick={() => remember(m.content)} className="mt-2 text-xs underline opacity-70 hover:opacity-100">
                  Remember this
                </button>
              )}
            </div>
          ))}
          {sending && <p className="text-sm text-zinc-500">NOAH is thinking…</p>}
          <div ref={bottomRef} />
        </div>
        {error && <p className="border-t bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
        {savedMemory && <p className="border-t bg-green-50 px-4 py-2 text-sm text-green-700">{savedMemory}</p>}
        <form onSubmit={send} className="flex items-center gap-2 border-t p-3">
          {speechSupported && (
            <button type="button" onClick={startListening} disabled={listening}
              title="Push to talk"
              className={`rounded border px-3 py-2 text-sm ${listening ? "bg-red-100" : "hover:bg-zinc-100"}`}>
              {listening ? "● Listening…" : "🎙️ Talk"}
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message NOAH…"
            className="min-w-0 flex-1 rounded border px-3 py-2"
          />
          <label className="flex items-center gap-1 text-xs text-zinc-600" title="Read replies aloud">
            <input type="checkbox" checked={speakReplies} onChange={(e) => setSpeakReplies(e.target.checked)} />
            Speak
          </label>
          <button type="submit" disabled={sending || !input.trim()}
            className="rounded bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700 disabled:opacity-50">
            Send
          </button>
        </form>
        {!speechSupported && (
          <p className="border-t px-4 py-2 text-xs text-zinc-500">
            Voice input is not supported in this browser. Use Chrome or Edge for push-to-talk and spoken replies.
          </p>
        )}
      </section>
    </div>
  );
}
