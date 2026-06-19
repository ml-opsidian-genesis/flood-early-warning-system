"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import LogoutButton from "@/components/LogoutButton";

export default function Navbar({ session }: { session: any }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const getLinkClass = (path: string) => {
    const isActive = pathname === path;
    return `block md:inline-block px-3 py-2 rounded-md transition-colors text-sm font-medium ${
      isActive 
        ? "bg-blue-50 text-blue-700" 
        : "text-slate-600 hover:text-blue-600 hover:bg-slate-50"
    }`;
  };

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 relative">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900 z-50">
          <span className="text-xl">🌊</span>
          <span>
            Flood<span className="text-blue-600">Guard</span>
          </span>
        </Link>
        
        {/* Mobile menu button */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 -mr-2 text-slate-600 hover:text-blue-600 z-50 focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          {isOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        {/* Navigation items */}
        <nav className={`
          absolute top-full left-0 right-0 bg-white border-b border-slate-200 shadow-lg
          flex flex-col p-4 gap-2 transition-all duration-200 ease-in-out origin-top
          md:static md:flex-row md:items-center md:bg-transparent md:border-none md:shadow-none md:p-0 md:gap-1
          ${isOpen ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0 pointer-events-none md:opacity-100 md:scale-y-100 md:pointer-events-auto"}
        `}>
          <Link href="/" className={getLinkClass("/")}>
            Risk Map
          </Link>
          
          {session ? (
            <>
              <Link href="/dashboard" className={getLinkClass("/dashboard")}>
                Ops Dashboard
              </Link>
              <Link href="/locations" className={getLinkClass("/locations")}>
                Locations
              </Link>
              <Link href="/subscribers" className={getLinkClass("/subscribers")}>
                Subscribers
              </Link>
              <Link href="/rescue-shelters" className={getLinkClass("/rescue-shelters")}>
                Rescue Shelters
              </Link>
              <Link href="/alerts" className={getLinkClass("/alerts")}>
                Alerts
              </Link>
              <Link href="/generations" className={getLinkClass("/generations")}>
                Generations
              </Link>
              <Link href="/settings" className={getLinkClass("/settings")}>
                Settings
              </Link>
              
              <div className="mt-4 pt-4 border-t border-slate-100 md:hidden flex flex-col gap-3">
                <span className="text-xs text-slate-500 font-medium px-3">{session.email}</span>
                <div className="px-3">
                  <LogoutButton />
                </div>
              </div>
              
              <div className="hidden md:flex md:items-center md:gap-4 md:ml-4">
                <span className="text-xs text-slate-400">{session.email}</span>
                <LogoutButton />
              </div>
            </>
          ) : (
            <Link href="/login" className={getLinkClass("/login")}>
              Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
