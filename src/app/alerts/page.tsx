import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import AlertsClient from "@/components/AlertsClient";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?from=/alerts");
  return <AlertsClient />;
}
