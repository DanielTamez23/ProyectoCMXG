"use client";

import { useEffect, useState } from "react";
import { Activity, LayoutDashboard, LogOut, QrCode } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getSession } from "@/lib/auth";
import CarrierLogo from "@/components/CarrierLogo";

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
      <div className="min-h-screen flex items-center justify-center text-slate-600 bg-[#f1f5f9]">
        Verifying session...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#f1f5f9]">
      {/* Sidebar */}
      <aside className="w-64 glass border-r border-slate-300 hidden md:flex flex-col bg-white">
        <div className="p-5 border-b border-slate-200">
          <CarrierLogo height={36} />
          <p className="text-xs text-slate-500 mt-2 font-medium tracking-wide uppercase">Station Flow</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 mt-4">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium border transition-colors ${pathname === "/dashboard" ? "bg-[#152C73] text-white border-[#152C73]" : "text-slate-700 border-transparent hover:text-slate-900 hover:bg-slate-100"}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Overview
          </Link>
          <Link
            href="/dashboard/flow"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium border transition-colors ${pathname === "/dashboard/flow" ? "bg-[#152C73] text-white border-[#152C73]" : "text-slate-700 border-transparent hover:text-slate-900 hover:bg-slate-100"}`}
          >
            <Activity className="w-5 h-5" />
            Visual Flow
          </Link>
          <Link
            href="/dashboard/qr"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium border transition-colors ${pathname === "/dashboard/qr" ? "bg-[#152C73] text-white border-[#152C73]" : "text-slate-700 border-transparent hover:text-slate-900 hover:bg-slate-100"}`}
          >
            <QrCode className="w-5 h-5" />
            QR Print
          </Link>
        </nav>
        
        <div className="p-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 hover:text-red-700 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between md:hidden">
          <CarrierLogo height={32} />
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
