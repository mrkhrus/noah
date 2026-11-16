import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect("/chat");
  return (
    <div className="py-10">
      <h1 className="text-4xl font-bold tracking-tight">Meet NOAH — your AI assistant.</h1>
      <p className="mt-4 max-w-2xl text-lg text-zinc-600">
        Chat in English, Urdu or Roman Urdu. Connect your own Google account and let NOAH
        read your email, calendar and files, summarise them, and help you decide — and
        NOAH never sends, creates or shares anything without asking you first.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/signup" className="rounded bg-zinc-900 px-5 py-3 text-white hover:bg-zinc-700">
          Create a free account
        </Link>
        <Link href="/login" className="rounded border px-5 py-3 hover:bg-zinc-100">
          Log in
        </Link>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="rounded border bg-white p-4">
          <h2 className="font-semibold">Real answers, with sources</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Answers drawn from your own Gmail, Calendar or Drive carry a citation line, so
            you can check where every fact came from.
          </p>
        </div>
        <div className="rounded border bg-white p-4">
          <h2 className="font-semibold">Your approval comes first</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Sending an email, creating an event or sharing a file always waits for your
            explicit approval. Every action is recorded in an audit log you can review.
          </p>
        </div>
        <div className="rounded border bg-white p-4">
          <h2 className="font-semibold">Your accounts, your data</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Each person signs up with their own account and connects their own Google
            account. Your data is never visible to anyone else.
          </p>
        </div>
        <div className="rounded border bg-white p-4">
          <h2 className="font-semibold">Tasks, memory, reminders</h2>
          <p className="mt-1 text-sm text-zinc-600">
            A one-at-a-time task queue with pause and cancel, long-term memory you can
            review and delete, and reminders that respect your quiet hours.
          </p>
        </div>
      </div>
      <p className="mt-10 text-sm text-zinc-500">
        NOAH is a final-year project by Ali Noor (University of Southern Punjab).
        Website v1 implements FR-14 Option B: FR-01 accounts, FR-02 conversation,
        FR-03 voice, FR-04 tasks, FR-05 sync, FR-06 scope control, FR-07 permissions,
        FR-11 memory and FR-12 notifications.
      </p>
    </div>
  );
}
