"use client";

import React, { useEffect, useState, useRef } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useKeyboardShortcuts } from "@/providers/KeyboardShortcutsProvider";
import {
  LayoutDashboard,
  Inbox,
  ShieldAlert,
  Trash2,
  PenSquare,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  Moon,
  Sun,
  Edit,
  RefreshCw,
  Keyboard,
  Search,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { name: "Inbox", href: "/inbox", icon: Inbox, keywords: "email messages mail" },
  { name: "Spam", href: "/spam", icon: ShieldAlert, keywords: "junk filter" },
  { name: "Trash", href: "/trash", icon: Trash2, keywords: "deleted removed bin" },
  { name: "AI Drafts", href: "/drafts", icon: PenSquare, keywords: "write compose reply ai" },
  { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen, keywords: "docs documents files rag" },
  { name: "Contacts", href: "/contacts", icon: Users, keywords: "people directory address" },
  { name: "Analytics", href: "/analytics", icon: BarChart3, keywords: "stats metrics reports" },
  { name: "Settings", href: "/settings", icon: Settings, keywords: "preferences config account" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";
  const { setIsComposeOpen, setShowShortcutsHelp } = useKeyboardShortcuts();
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <Command
              className="rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden"
              loop
            >
              <div className="flex items-center gap-2 border-b border-zinc-100 px-4 dark:border-zinc-800">
                <Search className="h-4 w-4 shrink-0 text-zinc-400" />
                <Command.Input
                  ref={inputRef}
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent py-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
                <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-zinc-200 bg-zinc-100 px-1.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  ESC
                </kbd>
              </div>

              <Command.List className="max-h-[320px] overflow-y-auto p-2 scrollbar-thin">
                <Command.Empty className="flex items-center justify-center py-8 text-sm text-zinc-400 dark:text-zinc-500">
                  No results found.
                </Command.Empty>

                <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-400 [&_[cmdk-group-heading]]:dark:text-zinc-500">
                  <Command.Item
                    onSelect={() => runAction(() => setIsComposeOpen(true))}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 transition-colors data-[selected=true]:bg-orange-50 data-[selected=true]:text-orange-700 dark:text-zinc-300 dark:data-[selected=true]:bg-orange-500/10 dark:data-[selected=true]:text-orange-400"
                  >
                    <Edit className="h-4 w-4 shrink-0" />
                    <span className="flex-1">Compose New Email</span>
                    <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-zinc-200 bg-zinc-100 px-1.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-800">C</kbd>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runAction(() => { window.dispatchEvent(new Event("refresh-data")); router.refresh(); })}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 transition-colors data-[selected=true]:bg-orange-50 data-[selected=true]:text-orange-700 dark:text-zinc-300 dark:data-[selected=true]:bg-orange-500/10 dark:data-[selected=true]:text-orange-400"
                  >
                    <RefreshCw className="h-4 w-4 shrink-0" />
                    <span className="flex-1">Refresh Data</span>
                    <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-zinc-200 bg-zinc-100 px-1.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-800">R</kbd>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runAction(() => setTheme(isDark ? "light" : "dark"))}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 transition-colors data-[selected=true]:bg-orange-50 data-[selected=true]:text-orange-700 dark:text-zinc-300 dark:data-[selected=true]:bg-orange-500/10 dark:data-[selected=true]:text-orange-400"
                  >
                    {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
                    <span className="flex-1">{isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}</span>
                    <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-zinc-200 bg-zinc-100 px-1.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-800">T</kbd>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runAction(() => setShowShortcutsHelp(true))}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 transition-colors data-[selected=true]:bg-orange-50 data-[selected=true]:text-orange-700 dark:text-zinc-300 dark:data-[selected=true]:bg-orange-500/10 dark:data-[selected=true]:text-orange-400"
                  >
                    <Keyboard className="h-4 w-4 shrink-0" />
                    <span className="flex-1">View Keyboard Shortcuts</span>
                    <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-zinc-200 bg-zinc-100 px-1.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-800">?</kbd>
                  </Command.Item>
                </Command.Group>

                <Command.Separator className="my-1.5 h-px bg-zinc-100 dark:bg-zinc-800" />

                <Command.Group heading="Navigation" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-400 [&_[cmdk-group-heading]]:dark:text-zinc-500">
                  {NAV_ITEMS.map((item) => (
                    <Command.Item
                      key={item.href}
                      keywords={[item.keywords]}
                      onSelect={() => runAction(() => router.push(item.href))}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 transition-colors data-[selected=true]:bg-orange-50 data-[selected=true]:text-orange-700 dark:text-zinc-300 dark:data-[selected=true]:bg-orange-500/10 dark:data-[selected=true]:text-orange-400"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">Go to {item.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>

              <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2 dark:border-zinc-800">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                  <kbd className="inline-flex h-5 items-center rounded border border-zinc-200 bg-zinc-100 px-1 text-[10px] dark:border-zinc-700 dark:bg-zinc-800">↑↓</kbd>
                  <span>navigate</span>
                  <kbd className="ml-2 inline-flex h-5 items-center rounded border border-zinc-200 bg-zinc-100 px-1 text-[10px] dark:border-zinc-700 dark:bg-zinc-800">↵</kbd>
                  <span>select</span>
                </div>
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  <kbd className="inline-flex h-5 items-center rounded border border-zinc-200 bg-zinc-100 px-1.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-800">⌘K</kbd>
                  <span className="ml-1">to toggle</span>
                </div>
              </div>
            </Command>
          </div>
        </div>
      )}
    </>
  );
}
