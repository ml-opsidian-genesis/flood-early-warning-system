import type { Metadata } from "next";
import Link from "next/link";
// Suppress TS error for side-effect CSS import when no declarations are present
// @ts-ignore
import "./globals.css";
import { getAdminSession } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "FloodGuard — Flood Early-Warning System",
  description:
    "Autonomous flood-risk early-warning for Sri Lanka. Daily ML scoring with WhatsApp alerts.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
              <span className="text-xl">🌊</span>
              <span>
                Flood<span className="text-blue-600">Guard</span>
              </span>
            </Link>
            <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
              <Link href="/" className="hover:text-blue-600">
                Risk Map
              </Link>
              {session ? (
                <>
                  <Link href="/dashboard" className="hover:text-blue-600">
                    Ops Dashboard
                  </Link>
                  <Link href="/locations" className="hover:text-blue-600">
                    Locations
                  </Link>
                  <span className="hidden text-xs text-slate-400 sm:inline">{session.email}</span>
                  <LogoutButton />
                </>
              ) : (
                <Link href="/login" className="hover:text-blue-600">
                  Admin
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 py-8 text-center text-xs text-slate-400">
          FloodGuard · ML Opsidian: Genesis · Flood-risk model + autonomous WhatsApp alerts
        </footer>
      </body>
    </html>
  );
}
