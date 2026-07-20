"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Inbox,
  Mail,
  Clock,
  ArrowRight,
  Loader2,
  WifiOff,
  Settings,
  TrendingUp,
  Activity,
  Zap,
  Users,
  BarChart3,
  Server,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/providers/AuthProvider";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import api from "@/lib/api";
import { useSocket } from "@/providers/SocketProvider";
import comingSoonData from "@/data/coming_soon.json";

const IconMap: Record<string, React.ElementType> = {
  Zap,
  Users,
  BarChart3,
  Settings,
  Activity,
  Server,
  ShieldCheck
};

interface ComingSoonFeature {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
}

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
  subtext,
  trend,
  trendUp = true,
  accent,
  isLoading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext?: string;
  trend?: string;
  trendUp?: boolean;
  accent: string;
  isLoading: boolean;
}) {
  return (
    <div className={`group relative overflow-hidden min-w-0 animate-fade-in rounded-xl border p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-transparent dark:shadow-none flex flex-col justify-between ${accent}`}>
      {/* Subtle Background Watermark */}
      <Icon className="absolute top-[55%] -translate-y-1/2 right-4 h-16 w-16 opacity-10 pointer-events-none" />

      <div className="relative flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-black/5 dark:bg-black/20 backdrop-blur-sm shadow-inner transition-colors group-hover:bg-black/10 dark:group-hover:bg-black/30">
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </h3>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/40 dark:bg-black/20 backdrop-blur-sm ${trendUp ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            <TrendingUp className={`h-3 w-3 ${trendUp ? '' : 'rotate-180'}`} />
            {trend}
          </div>
        )}
      </div>
      <div className="relative">
        {isLoading ? (
          <Skeleton className="mt-1 h-6 w-20 bg-white/50 dark:bg-zinc-800/50" />
        ) : (
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight truncate pl-1">
              {value}
            </div>
            {subtext && (
              <p className="mt-1 pl-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 opacity-80">
                {subtext}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const [selectedFeature, setSelectedFeature] = useState<ComingSoonFeature | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceRender(x => x + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [threadsRes, statusRes] = await Promise.all([
        api.get('/gmail/threads?limit=5'),
        api.get('/gmail/status')
      ]);

      const threadsData = threadsRes.data.data;
      const statusData = statusRes.data.data;

      return {
        totalThreads: threadsData.pagination.total,
        totalEmails: threadsData.pagination.totalEmails || 0,
        lastSyncAt: statusData.lastSuccessfulSyncAt,
        syncStatus: statusData.activeSync ? "SYNCING" : statusData.connectionStatus,
        recentThreads: threadsData.threads,
      } as DashboardStats;
    }
  });

  useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    };
    window.addEventListener('refresh-data', handleRefresh);

    if (!socket) return () => window.removeEventListener('refresh-data', handleRefresh);

    const handleSyncStarted = () => {
      queryClient.setQueryData(['dashboard-stats'], (old: DashboardStats | undefined) => {
        if (!old) return old;
        return { ...old, syncStatus: "SYNCING" };
      });
    };

    const handleSyncCompleted = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    };

    socket.on('sync:started', handleSyncStarted);
    socket.on('sync:completed', handleSyncCompleted);

    return () => {
      window.removeEventListener('refresh-data', handleRefresh);
      socket.off('sync:started', handleSyncStarted);
      socket.off('sync:completed', handleSyncCompleted);
    };
  }, [socket, queryClient]);

  const greeting = getGreeting();
  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  let syncStatusLabel = "—";

  if (!isConnected) {
    syncStatusLabel = "Disconnected";
  } else if (stats?.syncStatus === "SYNCING") {
    syncStatusLabel = "Syncing...";
  } else {
    syncStatusLabel = "Connected";
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
          subtext="Total processed threads"
          trend="All Time"
          trendUp={true}
          accent="bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-500/15"
          isLoading={isLoading}
        />
        <StatCard
          icon={Inbox}
          label="Total Emails"
          value={stats?.totalEmails?.toString() || "0"}
          subtext="In your active database"
          trend="+New"
          trendUp={true}
          accent="bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15"
          isLoading={isLoading}
        />
        <StatCard
          icon={stats?.syncStatus === "SYNCING" ? (props: React.ComponentProps<typeof Loader2>) => <Loader2 {...props} className={`${props.className || ''} animate-spin`} /> : (!isConnected ? WifiOff : Activity)}
          label="Sync Status"
          value={syncStatusLabel}
          subtext={stats?.syncStatus === "SYNCING" ? "Fetching new emails..." : (isConnected ? "Monitoring inbox live" : "Connection error")}
          accent={stats?.syncStatus === "SYNCING" ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15" : (!isConnected ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/15" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15")}
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
          subtext="Last successful connection"
          accent="bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/15"
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 animate-fade-in lg:col-span-2 rounded-xl border border-zinc-300 bg-white shadow-md dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 sm:px-5 py-3 sm:py-4 dark:border-zinc-800">
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
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
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

        <div className="min-w-0 relative lg:h-full">
          <div className="lg:absolute lg:inset-0 flex flex-col animate-fade-in rounded-xl border border-zinc-300 bg-white p-4 sm:p-5 shadow-md dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-xl">
            <h2 className="shrink-0 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Coming Soon
            </h2>
            <div className="mt-4 space-y-3 flex-1 overflow-y-auto min-h-0 pr-1 sm:pr-2">
              {comingSoonData.map((feature: ComingSoonFeature) => {
                const FeatureIcon = IconMap[feature.icon] || Settings;
                return (
                  <div
                    key={feature.id}
                    onClick={() => setSelectedFeature(feature)}
                    className="group flex items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-3 cursor-pointer transition-all hover:bg-zinc-100 hover:border-zinc-400 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800/30 dark:hover:bg-zinc-800/80 dark:hover:border-zinc-600"
                  >
                    <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 dark:bg-red-500/20 dark:text-red-400 transition-transform group-hover:scale-110 group-hover:bg-orange-500/20 dark:group-hover:bg-red-500/30">
                      <FeatureIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors group-hover:text-orange-600 dark:group-hover:text-red-400">
                        {feature.title}
                      </p>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        {feature.subtitle}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!selectedFeature} onOpenChange={(open) => !open && setSelectedFeature(null)}>
        <DialogContent className="sm:max-w-md border-zinc-200/80 dark:border-zinc-800/50 p-0 overflow-hidden bg-white shadow-2xl dark:bg-zinc-950/95 dark:backdrop-blur-xl">
          <div className="h-32 bg-gradient-to-b from-orange-500/15 to-transparent dark:from-red-500/15 dark:to-transparent absolute top-0 left-0 right-0 pointer-events-none" />
          <DialogHeader className="px-6 pt-10 pb-6 relative">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_8px_30px_rgba(249,115,22,0.25)] border border-orange-200 dark:bg-zinc-900 dark:border-zinc-800 dark:shadow-[0_8px_30px_rgba(239,68,68,0.15)] mb-6">
              {selectedFeature && React.createElement(IconMap[selectedFeature.icon] || Settings, {
                className: "h-7 w-7 text-orange-500 dark:text-red-400"
              })}
            </div>
            <DialogTitle className="text-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {selectedFeature?.title}
            </DialogTitle>
            <DialogDescription className="text-center pt-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400 px-4">
              {selectedFeature?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-zinc-50/80 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800/50 px-6 py-5 flex justify-center">
            <Button className="w-full sm:w-auto px-10 bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-md shadow-orange-500/20 dark:bg-red-600 dark:hover:bg-red-700 dark:shadow-none transition-all" onClick={() => setSelectedFeature(null)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
