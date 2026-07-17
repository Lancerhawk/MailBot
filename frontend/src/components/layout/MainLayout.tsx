"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const pathname = usePathname();

  const isFullWidth = ["/inbox", "/spam", "/trash", "/drafts"].includes(pathname);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-stone-50 transition-colors duration-300 dark:bg-zinc-950">
      <Sidebar mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header setSidebarOpen={setSidebarOpen} />
        <main className={`flex-1 ${isFullWidth ? "overflow-hidden" : "overflow-y-auto [scrollbar-gutter:stable]"}`}>
          {isFullWidth ? (
            children
          ) : (
            <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

