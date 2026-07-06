"use client";

import { useState, useEffect, useMemo } from "react";
import api from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { ThreadViewer } from "./ThreadViewer";
import { Search, Mail, Inbox as InboxIcon } from "lucide-react";
import { Skeleton } from "../ui/skeleton";

interface Participant {
  emailAddress: string;
  displayName: string | null;
  role: string;
}

interface EmailThread {
  id: string;
  subject: string;
  lastMessageAt: string;
  messageCount: number;
  emails: {
    snippet: string;
    isRead: boolean;
    participants: Participant[];
  }[];
}

const AVATAR_COLORS = [
  { bg: "bg-rose-100 dark:bg-rose-500/20", text: "text-rose-600 dark:text-rose-400" },
  { bg: "bg-sky-100 dark:bg-sky-500/20", text: "text-sky-600 dark:text-sky-400" },
  { bg: "bg-violet-100 dark:bg-violet-500/20", text: "text-violet-600 dark:text-violet-400" },
  { bg: "bg-amber-100 dark:bg-amber-500/20", text: "text-amber-600 dark:text-amber-400" },
  { bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400" },
  { bg: "bg-fuchsia-100 dark:bg-fuchsia-500/20", text: "text-fuchsia-600 dark:text-fuchsia-400" },
  { bg: "bg-cyan-100 dark:bg-cyan-500/20", text: "text-cyan-600 dark:text-cyan-400" },
  { bg: "bg-orange-100 dark:bg-orange-500/20", text: "text-orange-600 dark:text-orange-400" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function ThreadSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

import { useSocket } from "@/providers/SocketProvider";

export function Inbox() {
  const { socket } = useSocket();
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchThreads();

    if (!socket) return;

    const handleSyncCompleted = () => {
      fetchThreads();
    };

    socket.on('sync:completed', handleSyncCompleted);

    return () => {
      socket.off('sync:completed', handleSyncCompleted);
    };
  }, [socket]);

  const fetchThreads = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/gmail/threads?limit=100");
      setThreads(res.data.data.threads);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const getSenderInfo = (thread: EmailThread) => {
    const sender = thread.emails[0]?.participants.find(p => p.role === "SENDER");
    const name = sender?.displayName || sender?.emailAddress || "Unknown";
    const initial = name.charAt(0).toUpperCase();
    return { name, initial, color: getAvatarColor(name) };
  };

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter(t => {
      const sender = getSenderInfo(t);
      return (
        t.subject?.toLowerCase().includes(q) ||
        sender.name.toLowerCase().includes(q) ||
        t.emails[0]?.snippet?.toLowerCase().includes(q)
      );
    });
  }, [threads, searchQuery]);

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="flex w-full flex-col border-r border-zinc-200 dark:border-zinc-800 md:w-[380px] lg:w-[420px] xl:w-[440px]">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:ring-1 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:bg-zinc-800 dark:focus:ring-zinc-700"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {Array.from({ length: 8 }).map((_, i) => (
                <ThreadSkeleton key={i} />
              ))}
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                <InboxIcon className="h-8 w-8 text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {searchQuery ? "No matching conversations" : "Your inbox is empty"}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {searchQuery ? "Try a different search term" : "Sync your email to get started"}
              </p>
            </div>
          ) : (
            <div className="stagger-children divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {filteredThreads.map((thread) => {
                const isUnread = !thread.emails[0]?.isRead;
                const isSelected = selectedThreadId === thread.id;
                const sender = getSenderInfo(thread);

                return (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`group relative flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-all duration-150
                      ${isSelected
                        ? "bg-orange-50/80 dark:bg-orange-500/5"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                      }`}
                  >
                    {isSelected && (
                      <div className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-orange-500 dark:bg-orange-400" />
                    )}

                    <div className={`relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${sender.color.bg} ${sender.color.text}`}>
                      {sender.initial}
                      {isUnread && (
                        <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500 dark:border-zinc-950" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${isUnread ? "font-bold text-zinc-900 dark:text-zinc-50" : "font-medium text-zinc-600 dark:text-zinc-300"}`}>
                          {sender.name}
                          {thread.messageCount > 1 && (
                            <span className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-zinc-200 px-1 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                              {thread.messageCount}
                            </span>
                          )}
                        </p>
                        <span className={`shrink-0 text-[11px] ${isUnread ? "font-semibold text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-500"}`}>
                          {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: false })}
                        </span>
                      </div>
                      <p className={`mt-0.5 truncate text-[13px] ${isUnread ? "font-semibold text-zinc-800 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"}`}>
                        {thread.subject || "(No Subject)"}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400 dark:text-zinc-500">
                        {thread.emails[0]?.snippet}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="hidden flex-1 md:flex">
        {selectedThreadId ? (
          <ThreadViewer threadId={selectedThreadId} key={selectedThreadId} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-100 dark:bg-zinc-800/80">
              <Mail className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Select a conversation
              </p>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                Choose a thread from the left to read it here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
