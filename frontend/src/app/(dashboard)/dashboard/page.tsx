"use client";

import React, { useEffect, useState } from "react";
import {
  Inbox,
  BarChart3,
  Mail,
  Clock,
  ArrowRight,
  CheckCircle,
  Loader2,
  WifiOff,
  Users,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/providers/AuthProvider";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import api from "@/lib/api";
import { useSocket } from "@/providers/SocketProvider";
import { toast } from "@/lib/toast";

interface DashboardStats {
  totalThreads: number;
  totalEmails: number;
  lastSyncAt: string | null;
  syncStatus: string;
  recentThreads: {
    id: string;
    subject: string;
    lastMessageAt: string;
    messageCount: number;
    emails: {
      snippet: string;
      isRead: boolean;
      participants: { emailAddress: string; displayName: string | null; role: string }[];
    }[];
  }[];
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  isLoading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
  isLoading: boolean;
}) {
  return (
    <div className="min-w-0 animate-fade-in rounded-xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            {label}
          </p>
          {isLoading ? (
            <Skeleton className="mt-1 h-6 w-16" />
          ) : (
            <p className="mt-0.5 text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
              {value}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async (isRefresh = false) => {
    try {
      const threadsUrl = isRefresh ? "/gmail/threads?limit=5&refresh=true" : "/gmail/threads?limit=5";
      const [threadsRes, statusRes] = await Promise.all([
        api.get(threadsUrl),
        api.get("/gmail/status"),
      ]);

      const threadsData = threadsRes.data.data;
      const statusData = statusRes.data.data;

      setStats({
        totalThreads: threadsData.pagination.total,
        totalEmails: threadsData.pagination.totalEmails || 0,
        lastSyncAt: statusData.lastSuccessfulSyncAt,
        syncStatus: statusData.activeSync ? "SYNCING" : statusData.connectionStatus,
        recentThreads: threadsData.threads,
      });
    } catch (e: unknown) {
      const err = e as { response?: { status: number } };
      if (err?.response?.status === 429) {
        toast.error("Please wait 1 minute before refreshing again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDashboardData();
    }, 0);

    const handleRefresh = () => {
      fetchDashboardData();
    };
    window.addEventListener('refresh-data', handleRefresh);

    if (!socket) return () => window.removeEventListener('refresh-data', handleRefresh);

    const handleSyncStarted = () => {
      setStats(prev => prev ? { ...prev, syncStatus: "SYNCING" } : null);
    };

    const handleSyncCompleted = () => {
      fetchDashboardData();
    };

    socket.on('sync:started', handleSyncStarted);
    socket.on('sync:completed', handleSyncCompleted);

    const ticker = setInterval(() => {
      setStats(prev => prev ? { ...prev } : null); // Force re-render for formatDistanceToNow
    }, 60000);

    return () => {
      window.removeEventListener('refresh-data', handleRefresh);
      socket.off('sync:started', handleSyncStarted);
      socket.off('sync:completed', handleSyncCompleted);
      clearInterval(ticker);
      clearTimeout(timer);
    };
  }, [socket]);

  const greeting = getGreeting();
  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  let syncStatusLabel = "—";
  let syncAccent = "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";

  if (!isConnected) {
    syncStatusLabel = "Disconnected";
    syncAccent = "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400";

  } else if (stats?.syncStatus === "SYNCING") {
    syncStatusLabel = "Syncing...";
    syncAccent = "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400";
  } else {
    syncStatusLabel = "Connected";
    syncAccent = "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400";
  }

  return (
    <div className="flex h-full flex-col gap-8">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Here&apos;s what&apos;s happening with your email today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Mail}
          label="Conversations"
          value={stats?.totalThreads?.toString() || "0"}
          accent="bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
          isLoading={isLoading}
        />
        <StatCard
          icon={Inbox}
          label="Total Emails"
          value={stats?.totalEmails?.toString() || "0"}
          accent="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
          isLoading={isLoading}
        />
        <StatCard
          icon={stats?.syncStatus === "SYNCING" ? (props: React.ComponentProps<typeof Loader2>) => <Loader2 {...props} className={`${props.className || ''} animate-spin`} /> : (!isConnected ? WifiOff : CheckCircle)}
          label="Sync Status"
          value={syncStatusLabel}
          accent={syncAccent}
          isLoading={isLoading}
        />
        <StatCard
          icon={Clock}
          label="Last Sync"
          value={
            stats?.lastSyncAt
              ? formatDistanceToNow(new Date(stats.lastSyncAt), { addSuffix: true })
                .replace("about ", "")
                .replace("less than a minute ago", "Just now")
              : "Never"
          }
          accent="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 animate-fade-in lg:col-span-2 rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 sm:px-5 py-3 sm:py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Recent Conversations
            </h2>
            <Link href="/inbox">
              <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-[11px] sm:text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
                View All
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 sm:px-5 py-3.5">
                  <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
              ))
            ) : stats?.recentThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Mail className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                <p className="text-sm text-zinc-400 dark:text-zinc-500">
                  No conversations yet
                </p>
              </div>
            ) : (
              stats?.recentThreads.map((thread) => {
                const sender = thread.emails[0]?.participants.find(
                  (p) => p.role === "SENDER"
                );
                const senderName =
                  sender?.displayName || sender?.emailAddress || "Unknown";
                const isUnread = !thread.emails[0]?.isRead;

                return (
                  <Link
                    key={thread.id}
                    href="/inbox"
                    className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  >
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {senderName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <p className={`truncate text-xs sm:text-sm ${isUnread ? "font-bold text-zinc-900 dark:text-zinc-50" : "font-medium text-zinc-700 dark:text-zinc-300"}`}>
                          {senderName}
                        </p>
                        {isUnread && (
                          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="truncate text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {thread.subject || "(No Subject)"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] sm:text-[11px] text-zinc-400 dark:text-zinc-500 ml-1">
                      {formatDistanceToNow(new Date(thread.lastMessageAt), {
                        addSuffix: false,
                      })}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="min-w-0 flex flex-col gap-4">
          <div className="animate-fade-in rounded-xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Quick Actions
            </h2>
            <div className="mt-4 flex flex-col gap-2.5">
              <Link href="/inbox">
                <Button className="w-full justify-start gap-2 bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700">
                  <Inbox className="h-4 w-4" />
                  Go to Inbox
                </Button>
              </Link>
            </div>
          </div>

          <div className="animate-fade-in rounded-xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Coming Soon
            </h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/30">
                <Users className="h-5 w-5 text-indigo-400" />
                <div>
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                    CRM & Contacts
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    Relationship management
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/30">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                    Email Analytics
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    Insights & trends
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/30">
                <BookOpen className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                    AI Knowledge Base
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    Train your assistant
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
