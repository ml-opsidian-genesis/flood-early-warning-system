import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import GenerationsClient from "@/components/GenerationsClient";

export const dynamic = "force-dynamic";

export default async function GenerationsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?from=/generations");
  return <GenerationsClient />;
}
