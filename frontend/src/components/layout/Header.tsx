"use client";

import * as React from "react";
import { Bell, Menu, Moon, Sun, RefreshCw } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/AuthProvider";
import { SyncIndicator } from "@/components/dashboard/SyncIndicator";
import { ComposeModal } from "@/components/dashboard/ComposeModal";
import { Edit } from "lucide-react";
import { toast } from "@/lib/toast";

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

export function Header({ setSidebarOpen }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [isComposeOpen, setIsComposeOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
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

      <div className="flex flex-1 items-center justify-between gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1">
        </div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="hidden sm:flex items-center gap-2 text-zinc-600 dark:text-zinc-300"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsComposeOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
            <Edit className="h-4 w-4" />
            <span className="hidden sm:inline">Compose</span>
          </Button>
          <SyncIndicator />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="-m-2.5 p-2.5 text-zinc-400 hover:text-zinc-500"
          >
            <span className="sr-only">Toggle theme</span>
            {mounted && theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <div
            className="hidden lg:block lg:h-6 lg:w-px lg:bg-zinc-200 dark:lg:bg-zinc-800"
            aria-hidden="true"
          />

          <div className="relative">
            <Button
              variant="ghost"
              className="-m-1.5 flex items-center p-1.5"
              onClick={() => {
                const menu = document.getElementById('user-menu');
                menu?.classList.toggle('hidden');
              }}
            >
              <span className="sr-only">Open user menu</span>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
              )}
              <span className="hidden lg:flex lg:items-center">
                <span
                  className="ml-4 text-sm font-semibold leading-6 text-zinc-900 dark:text-zinc-50"
                  aria-hidden="true"
                >
                  {user?.name || user?.email || 'User'}
                </span>
              </span>
            </Button>

            <div id="user-menu" className="hidden absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-zinc-900/5 focus:outline-none dark:bg-zinc-900 dark:ring-zinc-800">
              <button
                onClick={() => logout()}
                className="block w-full px-3 py-1 text-sm leading-6 text-zinc-900 hover:bg-zinc-50 text-left dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>
      <ComposeModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} />
    </header>
  );
}
