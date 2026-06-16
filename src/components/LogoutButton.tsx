"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function logout() {
    start(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    });
  }

  return (
    <button onClick={logout} disabled={pending} className="hover:text-blue-600 disabled:opacity-60">
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
