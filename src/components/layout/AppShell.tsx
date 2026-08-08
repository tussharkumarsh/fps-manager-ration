"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { useLoadAllHistory } from "@/hooks/useLoadAllHistory";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  useLoadAllHistory();

  if (isLoginPage) {
    return <main className="flex-1 overflow-auto w-full">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </>
  );
}
