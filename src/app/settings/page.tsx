import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import SettingsClient from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?from=/settings");
  return <SettingsClient session={session} />;
}
