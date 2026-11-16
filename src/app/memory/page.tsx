import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import MemoryUI from "@/components/MemoryUI";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Memory</h1>
      <MemoryUI />
    </div>
  );
}
