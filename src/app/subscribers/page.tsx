import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import SubscribersClient from "@/components/SubscribersClient";

export const dynamic = "force-dynamic";

export default async function SubscribersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?from=/subscribers");
  return <SubscribersClient />;
}
