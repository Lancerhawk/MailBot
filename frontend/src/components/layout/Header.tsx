"use client";

import * as React from "react";
import { Menu, Moon, Sun, RefreshCw, ChevronDown, LogOut } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useAuth } from "@/providers/AuthProvider";
import { SyncIndicator } from "@/components/dashboard/SyncIndicator";
import { ComposeModal } from "@/components/dashboard/ComposeModal";
import { useKeyboardShortcuts } from "@/providers/KeyboardShortcutsProvider";
import { Edit } from "lucide-react";
import Image from "next/image";
interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

export function Header({ setSidebarOpen }: HeaderProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const { isComposeOpen, setIsComposeOpen } = useKeyboardShortcuts();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    
    // This triggers router.refresh() (Next.js server-side reload)
    router.refresh();
    
    // This triggers our custom event that tells client components like Inbox and ThreadViewer
    // to call api.get() directly and bypass the cache.
    window.dispatchEvent(new Event('refresh-data'));
    
    // Stop spinning after 1 second for visual feedback
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-zinc-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 dark:border-zinc-800 dark:bg-zinc-950">
      <button
        type="button"
        className="-m-2.5 p-2.5 text-zinc-700 lg:hidden dark:text-zinc-400"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">Open sidebar</span>
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      <div
        className="h-6 w-px bg-zinc-200 lg:hidden dark:bg-zinc-800"
        aria-hidden="true"
      />

      <div className="flex flex-1 items-center self-stretch lg:gap-x-6 min-w-0">
        <div className="flex flex-1 items-center justify-end gap-x-1 sm:gap-x-2 lg:gap-x-6 min-w-0">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="sm:w-auto sm:px-3 flex items-center sm:gap-2 text-zinc-600 dark:text-zinc-300"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button onClick={() => setIsComposeOpen(true)} size="icon" className="sm:w-auto sm:px-3 bg-orange-500 hover:bg-orange-600 text-white sm:gap-2">
            <Edit className="h-4 w-4" />
            <span className="hidden sm:inline">Compose</span>
          </Button>
          <SyncIndicator />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : undefined}
            className="-m-2.5 p-2.5 text-zinc-400 hover:text-zinc-500"
          >
            <span className="sr-only">Toggle theme</span>
            {mounted && isDark ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <div
            className="hidden lg:block lg:h-6 lg:w-px lg:bg-zinc-200 dark:lg:bg-zinc-800"
            aria-hidden="true"
          />

          <div className="relative ml-2 lg:ml-0" ref={menuRef}>
            <button
              className="flex items-center gap-x-2.5 p-1.5 pl-2 pr-3 rounded-full border border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 transition-all cursor-pointer dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-800"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span className="sr-only">Open user menu</span>
              {user?.avatarUrl ? (
                <Image src={user.avatarUrl} alt="Avatar" width={28} height={28} className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover ring-2 ring-white dark:ring-zinc-900" unoptimized />
              ) : (
                <div className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 ring-2 ring-white dark:ring-zinc-900">
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
              )}
              <span className="hidden lg:flex lg:items-center gap-1.5">
                <span
                  className="text-sm font-semibold leading-6 text-zinc-700 dark:text-zinc-200"
                  aria-hidden="true"
                >
                  {user?.name || user?.email || 'User'}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform duration-200", menuOpen ? "rotate-180" : "")} aria-hidden="true" />
              </span>
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 z-50 mt-2.5 w-48 origin-top-right rounded-xl bg-white p-1 shadow-lg ring-1 ring-zinc-200 focus:outline-none dark:bg-zinc-900 dark:ring-zinc-800"
                >
                  <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1 lg:hidden">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <ComposeModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} />
    </header>
  );
}
