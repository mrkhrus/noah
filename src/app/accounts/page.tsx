import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AccountsUI from "@/components/AccountsUI";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Connected accounts</h1>
      <AccountsUI />
    </div>
  );
}
