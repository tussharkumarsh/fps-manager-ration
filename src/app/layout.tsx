import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import AppShell from "@/components/layout/AppShell";
import GlobalLoader from "@/components/layout/GlobalLoader";

export const metadata: Metadata = {
  title: "FPS Smart Management System",
  description: "Fair Price Shop transaction management and analytics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex h-screen overflow-hidden">
        <Providers>
          <GlobalLoader />
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
