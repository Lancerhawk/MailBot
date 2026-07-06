"use client";

import * as React from "react";
import { Bell, Search, Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/AuthProvider";
import { SyncIndicator } from "@/components/dashboard/SyncIndicator";

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

export function Header({ setSidebarOpen }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

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
        <form className="relative flex w-full max-w-sm items-center" action="#" method="GET">
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          </div>
          <Input
            id="search-field"
            className="block h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 py-1 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus-visible:ring-zinc-700"
            placeholder="Search..."
            type="search"
            name="search"
          />
        </form>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
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
    </header>
  );
}
