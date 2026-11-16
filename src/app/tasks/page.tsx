import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import TasksUI from "@/components/TasksUI";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Tasks</h1>
      <p className="mb-4 text-sm text-zinc-600">
        One task runs at a time, oldest first (FR-04). Nothing is sent, created or shared without your approval.
      </p>
      <TasksUI />
    </div>
  );
}
