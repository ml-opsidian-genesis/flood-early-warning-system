import type { Metadata } from "next";
// Suppress TS error for side-effect CSS import when no declarations are present
// @ts-ignore
import "./globals.css";
import { getAdminSession } from "@/lib/auth";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Pravaha — Flood Early-Warning System",
  description:
    "Autonomous flood-risk early-warning for Sri Lanka. Daily flood risk scoring with WhatsApp alerts.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  return (
    <html lang="en">
      <body>
        <Navbar session={session} />
        <main className="mx-auto max-w-7xl px-4 pt-6 pb-4">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 py-4 text-center text-xs text-slate-400">
          Pravaha · Early Flood-risk Warning System
        </footer>
      </body>
    </html>
  );
}
