import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import RemindersUI from "@/components/RemindersUI";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Reminders</h1>
      <RemindersUI />
    </div>
  );
}
