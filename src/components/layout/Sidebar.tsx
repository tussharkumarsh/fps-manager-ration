"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, viewingDealer, clearViewingDealer } = useStore();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const isAdmin = session?.role === "admin";

  const navItems = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: "📊" },
    { href: "/transactions", label: t("nav.transactions"), icon: "📋" },
    { href: "/customers", label: t("nav.customers"), icon: "👥" },
    { href: "/inventory", label: t("nav.inventory"), icon: "📦" },
    { href: "/reports", label: t("nav.reports"), icon: "📑" },
    { href: "/sync", label: t("nav.sync"), icon: "🔄" },
    { href: "/profile", label: t("nav.profile"), icon: "👤" },
  ];
  const adminOnlyNavItems = [
    { href: "/dealers", label: t("nav.dealers"), icon: "🏪" },
    { href: "/settings", label: t("nav.settings"), icon: "⚙️" },
  ];
  const items = isAdmin ? [...navItems, ...adminOnlyNavItems] : navItems;

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
            {t("sidebar.appName")}
          </span>
        )}
      </div>

      {/* Language switcher */}
      <div className="px-2 pt-2">
        <LanguageSwitcher compact={!sidebarOpen} />
      </div>

      {/* Viewing-as-dealer banner */}
      {viewingDealer && sidebarOpen && (
        <div className="mx-2 mt-2 px-2 py-2 rounded-md bg-amber-500/20 text-amber-100 text-[11px] space-y-1">
          <div className="font-semibold truncate">
            {t("sidebar.viewing")}: {viewingDealer.displayName}
          </div>
          <div className="font-mono">{viewingDealer.fpsId}</div>
          <button
            onClick={clearViewingDealer}
            className="w-full mt-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white text-[11px] font-medium"
          >
            {t("sidebar.exitView")}
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map((item) => {
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
            {session.displayName && (
              <div className="text-white/80 font-medium truncate">{session.displayName}</div>
            )}
            <div>FPS: {session.fpsId}</div>
            <div>{new Date().toLocaleDateString("en-IN")}</div>
          </div>
        )}
        <button
          onClick={() => {
            // Belt-and-suspenders alongside syncSessionIdentity: wipes
            // this account's cached data immediately on sign-out rather
            // than waiting for the next login to detect the identity
            // change — matters most on a shared computer.
            useStore.getState().syncSessionIdentity("");
            signOut({ callbackUrl: "/login" });
          }}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          title={t("sidebar.signOut")}
        >
          <span>🚪</span>
          {sidebarOpen && <span>{t("sidebar.signOut")}</span>}
        </button>
      </div>
    </aside>
  );
}
