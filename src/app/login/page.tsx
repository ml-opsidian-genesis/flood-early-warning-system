import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  const session = await getAdminSession();
  if (session) redirect(searchParams.from || "/dashboard");

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <LoginForm from={searchParams.from} />
    </div>
  );
}
