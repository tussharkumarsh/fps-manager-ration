"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

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
