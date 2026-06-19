import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import RescueSheltersClient from "@/components/RescueSheltersClient";

export const dynamic = "force-dynamic";

export default async function RescueSheltersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?from=/rescue-shelters");
  return <RescueSheltersClient />;
}
