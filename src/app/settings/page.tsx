import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SettingsUI from "@/components/SettingsUI";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Settings</h1>
      <SettingsUI email={user.email} name={user.name} />
    </div>
  );
}
