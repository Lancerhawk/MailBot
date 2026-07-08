"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Inbox,
  PenSquare,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  HelpCircle,
  Mail,
  X,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Spam", href: "/spam", icon: ShieldAlert },
  { name: "Trash", href: "/trash", icon: Trash2 },
  { name: "AI Drafts", href: "/drafts", icon: PenSquare },
  { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

const secondaryNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Support", href: "/support", icon: HelpCircle },
];

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

function SidebarContent({ pathname, setMobileOpen }: { pathname: string, setMobileOpen?: (open: boolean) => void }) {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-6 dark:border-zinc-800">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity" onClick={() => setMobileOpen && setMobileOpen(false)}>
          <div className="flex h-8 w-8 items-center justify-center">
            <Image src="/logo.png" alt="MailBot Logo" width={32} height={32} className="h-full w-full object-contain" unoptimized />
          </div>
          <span className="text-lg font-bold tracking-tight bg-gradient-to-br from-zinc-900 to-zinc-600 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">MailBot</span>
        </Link>
        {setMobileOpen && (
          <button
            type="button"
            className="lg:hidden text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            onClick={() => setMobileOpen(false)}
          >
            <span className="sr-only">Close sidebar</span>
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
        <div className="flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen && setMobileOpen(false)}
                className={cn(
                  "relative group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
                  isActive
                    ? "text-orange-700 dark:text-red-500"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-md bg-orange-100 dark:bg-red-500/20"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "relative z-10 h-4 w-4 shrink-0 transition-colors duration-200",
                    isActive
                      ? "text-orange-700 dark:text-red-500"
                      : "text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-50"
                  )}
                  aria-hidden="true"
                />
                <span className="relative z-10">{item.name}</span>
              </Link>
            );
          })}

          <div className="my-2 h-px w-full bg-zinc-200 dark:bg-zinc-800" />

          {secondaryNavigation.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen && setMobileOpen(false)}
                className={cn(
                  "relative group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
                  isActive
                    ? "text-orange-700 dark:text-red-500"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-md bg-orange-100 dark:bg-red-500/20"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "relative z-10 h-4 w-4 shrink-0 transition-colors duration-200",
                    isActive
                      ? "text-orange-700 dark:text-red-500"
                      : "text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-50"
                  )}
                  aria-hidden="true"
                />
                <span className="relative z-10">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm"
              onClick={() => setMobileOpen && setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="relative flex w-full max-w-xs flex-1 flex-col bg-stone-50 dark:bg-zinc-950 shadow-xl"
            >
              <SidebarContent pathname={pathname} setMobileOpen={setMobileOpen} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="hidden border-r border-zinc-200 bg-stone-50 transition-colors duration-300 dark:border-zinc-800 dark:bg-zinc-950 lg:block lg:w-64 lg:shrink-0 lg:flex-col">
        <SidebarContent pathname={pathname} />
      </div>
    </>
  );
}
