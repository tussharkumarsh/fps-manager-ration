"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/transactions", label: "Transactions", icon: "📋" },
  { href: "/customers", label: "Customers", icon: "👥" },
  { href: "/inventory", label: "Inventory", icon: "📦" },
  { href: "/reports", label: "Reports", icon: "📑" },
  { href: "/sync", label: "Sync Data", icon: "🔄" },
  { href: "/profile", label: "Profile", icon: "👤" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useStore();
  const { data: session } = useSession();

  return (
    <aside
      className={cn(
        "flex flex-col bg-brand-700 transition-all duration-200 flex-shrink-0",
        sidebarOpen ? "w-56" : "w-14"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <button
          onClick={toggleSidebar}
          className="text-white text-lg hover:bg-white/10 rounded-md p-1 transition-colors"
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? "✕" : "☰"}
        </button>
        {sidebarOpen && (
          <span className="text-white font-bold text-sm whitespace-nowrap">
            FPS Manager
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "sidebar-link",
                isActive ? "sidebar-link-active" : "sidebar-link-inactive"
              )}
              title={item.label}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-white/10 space-y-2">
        {sidebarOpen && session?.fpsId && (
          <div className="px-2 text-[11px] text-white/50 space-y-0.5">
            <div>FPS: {session.fpsId}</div>
            <div>{new Date().toLocaleDateString("en-IN")}</div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          title="Sign out"
        >
          <span>🚪</span>
          {sidebarOpen && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
