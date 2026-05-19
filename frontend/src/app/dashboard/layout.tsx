"use client";

import { useEffect, useState } from "react";
import { Activity, LayoutDashboard, LogOut, QrCode } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getSession } from "@/lib/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/");
      return;
    }
    setAuthReady(true);
  }, [router]);

  const handleSignOut = () => {
    clearSession();
    router.push("/");
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Verifying session...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 glass border-r border-slate-300 hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-700 to-slate-900 flex items-center justify-center shadow-lg shadow-blue-700/20">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-lg tracking-tight">Station Flow</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium border transition-colors ${pathname === "/dashboard" ? "bg-blue-100 text-blue-900 border-blue-300" : "text-slate-700 border-transparent hover:text-slate-900 hover:bg-slate-200"}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Overview
          </Link>
          <Link
            href="/dashboard/flow"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium border transition-colors ${pathname === "/dashboard/flow" ? "bg-blue-100 text-blue-900 border-blue-300" : "text-slate-700 border-transparent hover:text-slate-900 hover:bg-slate-200"}`}
          >
            <Activity className="w-5 h-5" />
            Visual Flow
          </Link>
          <Link
            href="/dashboard/qr"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium border transition-colors ${pathname === "/dashboard/qr" ? "bg-blue-100 text-blue-900 border-blue-300" : "text-slate-700 border-transparent hover:text-slate-900 hover:bg-slate-200"}`}
          >
            <QrCode className="w-5 h-5" />
            QR Print
          </Link>
        </nav>
        
        <div className="p-4 border-t border-slate-300">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 hover:text-red-700 hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        {/* Top decorative gradient */}
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-blue-200/60 to-transparent pointer-events-none" />
        <div className="p-8 relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
