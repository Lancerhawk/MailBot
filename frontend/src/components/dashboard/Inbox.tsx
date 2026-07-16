"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { ThreadViewer } from "./ThreadViewer";
import { Search, Mail, Inbox as InboxIcon, Filter, Loader2 } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { toast } from "@/lib/toast";

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
import { useThreadCache } from "@/providers/ThreadCacheProvider";

function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

export function Inbox({ mode = "inbox" }: { mode?: "inbox" | "spam" | "trash" | "drafts" }) {
  const { socket } = useSocket();
  const { prefetchThreads } = useThreadCache();
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchThreads = useCallback(async (silent = false, pageNum = 1, append = false, isRefresh = false) => {
    try {
      if (!silent && !append) setIsLoading(true);
      if (append) setIsFetchingMore(true);

      let queryUrl = `/gmail/threads?limit=100&page=${pageNum}`;

      let actualFilter = filter;
      if (mode === "spam") actualFilter = "spam";
      if (mode === "trash") actualFilter = "trash";
      if (mode === "drafts") actualFilter = "drafts";

      if (actualFilter !== "all") {
        queryUrl += `&filter=${actualFilter}`;
      }
      if (debouncedSearch) {
        queryUrl += `&search=${encodeURIComponent(debouncedSearch)}`;
      }
      if (isRefresh) {
        queryUrl += `&refresh=true`;
      }

      const res = await api.get(queryUrl);
      const newThreads = res.data.data.threads;

      if (append) {
        setThreads(prev => [...prev, ...newThreads]);
      } else {
        setThreads(newThreads);
        setSelectedThreadId(prev => {
          if (prev && !newThreads.some((t: { id: string }) => t.id === prev)) return null;
          return prev;
        });
      }

      setHasMore(pageNum < res.data.data.pagination.totalPages);

      prefetchThreads(newThreads.map((t: { id: string }) => t.id));
    } catch (error: unknown) {
      const err = error as { response?: { status: number } };
      if (err?.response?.status === 429) {
        toast.error("Please wait 1 minute before refreshing again.");
      } else {
        console.error(error);
      }
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  }, [mode, filter, debouncedSearch, prefetchThreads]);

  const [prevDeps, setPrevDeps] = useState({ mode, filter, debouncedSearch });
  if (prevDeps.mode !== mode || prevDeps.filter !== filter || prevDeps.debouncedSearch !== debouncedSearch) {
    setPrevDeps({ mode, filter, debouncedSearch });
    setPage(1);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchThreads(false, 1, false);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchThreads]);

  useEffect(() => {
    const handleRefresh = () => {
      setPage(1);
      fetchThreads(false, 1, false, true);
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, [fetchThreads]);

  const loadMore = useCallback(() => {
    if (isLoading || isFetchingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchThreads(false, nextPage, true);
  }, [isLoading, isFetchingMore, hasMore, page, fetchThreads]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoading || isFetchingMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });

    if (node) observer.current.observe(node);
  }, [isLoading, isFetchingMore, hasMore, loadMore]);

  useEffect(() => {
    if (!socket) return;

    const handleSyncStarted = () => setIsSyncing(true);
    const handleSyncCompleted = () => {
      setIsSyncing(false);
      fetchThreads(true);
    };

    const updateThread = (threadId: string, updater: (t: EmailThread) => EmailThread) => {
      setThreads(prev => {
        const idx = prev.findIndex(t => t.id === threadId);
        if (idx === -1) return prev;
        const newThreads = [...prev];
        newThreads[idx] = updater(newThreads[idx]);
        return newThreads;
      });
    };

    const handleRead = (data: { threadId: string; value: boolean }) => updateThread(data.threadId, t => ({
      ...t, emails: t.emails.map(e => ({ ...e, isRead: data.value }))
    }));

    const handleDeleted = (data: { threadId: string; value: boolean }) => {
      if (mode === "inbox" && data.value === true) {
        setThreads(prev => prev.filter(t => t.id !== data.threadId));
        setSelectedThreadId(prev => prev === data.threadId ? null : prev);
      } else if (mode === "trash" && data.value === false) {
        setThreads(prev => prev.filter(t => t.id !== data.threadId));
        setSelectedThreadId(prev => prev === data.threadId ? null : prev);
      } else {
        fetchThreads(true);
      }
    };

    const handleSpam = (data: { threadId: string; value: boolean }) => {
      if (mode === "inbox" && data.value === true) {
        setThreads(prev => prev.filter(t => t.id !== data.threadId));
        setSelectedThreadId(prev => prev === data.threadId ? null : prev);
      } else if (mode === "spam" && data.value === false) {
        setThreads(prev => prev.filter(t => t.id !== data.threadId));
        setSelectedThreadId(prev => prev === data.threadId ? null : prev);
      } else {
        fetchThreads(true);
      }
    };

    const handlePermDelete = (data: { threadId: string }) => {
      setThreads(prev => prev.filter(t => t.id !== data.threadId));
      setSelectedThreadId(prev => prev === data.threadId ? null : prev);
    };

    const handleThreadUpdated = (data: { threadId: string; field: string; value: boolean }) => {
      const { threadId, field, value } = data;
      if (field === 'isRead') {
        updateThread(threadId, t => ({
          ...t, emails: t.emails.map(e => ({ ...e, isRead: value }))
        }));
      } else if (field === 'isDeleted') {
        if (mode === 'inbox' && value === true) {
          setThreads(prev => prev.filter(t => t.id !== threadId));
          setSelectedThreadId(prev => prev === threadId ? null : prev);
        } else if (mode === 'trash' && value === false) {
          setThreads(prev => prev.filter(t => t.id !== threadId));
          setSelectedThreadId(prev => prev === threadId ? null : prev);
        } else {
          fetchThreads(true);
        }
      } else if (field === 'isSpam') {
        if (mode === 'inbox' && value === true) {
          setThreads(prev => prev.filter(t => t.id !== threadId));
          setSelectedThreadId(prev => prev === threadId ? null : prev);
        } else if (mode === 'spam' && value === false) {
          setThreads(prev => prev.filter(t => t.id !== threadId));
          setSelectedThreadId(prev => prev === threadId ? null : prev);
        } else {
          fetchThreads(true);
        }
      } else if (field === 'isArchived') {
        if (mode === 'inbox' && value === true) {
          setThreads(prev => prev.filter(t => t.id !== threadId));
          setSelectedThreadId(prev => prev === threadId ? null : prev);
        } else {
          fetchThreads(true);
        }
      } else {
        fetchThreads(true);
      }
    };

    const handleThreadPermDelete = (data: { threadId: string }) => {
      setThreads(prev => prev.filter(t => t.id !== data.threadId));
      setSelectedThreadId(prev => prev === data.threadId ? null : prev);
    };

    socket.on('sync:started', handleSyncStarted);
    socket.on('sync:completed', handleSyncCompleted);
    socket.on('email:read', handleRead);
    socket.on('email:unread', handleRead);
    socket.on('email:deleted', handleDeleted);
    socket.on('email:restored', handleDeleted);
    socket.on('email:spam', handleSpam);
    socket.on('email:unspam', handleSpam);
    socket.on('email:permanently_deleted', handlePermDelete);
    socket.on('thread:updated', handleThreadUpdated);
    socket.on('thread:permanently_deleted', handleThreadPermDelete);

    return () => {
      socket.off('sync:started', handleSyncStarted);
      socket.off('sync:completed', handleSyncCompleted);
      socket.off('email:read', handleRead);
      socket.off('email:unread', handleRead);
      socket.off('email:deleted', handleDeleted);
      socket.off('email:restored', handleDeleted);
      socket.off('email:spam', handleSpam);
      socket.off('email:unspam', handleSpam);
      socket.off('email:permanently_deleted', handlePermDelete);
      socket.off('thread:updated', handleThreadUpdated);
      socket.off('thread:permanently_deleted', handleThreadPermDelete);
    };
  }, [socket, mode, fetchThreads]);

  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => fetchThreads(true);
    socket.on('analysis:completed', handleRefresh);
    socket.on('draft:generated', handleRefresh);
    socket.on('draft:regenerated', handleRefresh);
    socket.on('email:sent', handleRefresh);
    return () => {
      socket.off('analysis:completed', handleRefresh);
      socket.off('draft:generated', handleRefresh);
      socket.off('draft:regenerated', handleRefresh);
      socket.off('email:sent', handleRefresh);
    };
  }, [socket, fetchThreads]);

  const getSenderInfo = (thread: EmailThread) => {
    const sender = thread.emails[0]?.participants.find(p => p.role === "SENDER");
    const name = sender?.displayName || sender?.emailAddress || "Unknown";
    const initial = name.charAt(0).toUpperCase();
    return { name, initial, color: getAvatarColor(name) };
  };

  const filteredThreads = threads;

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden relative">
      <div className={`flex w-full flex-col border-r border-zinc-200 dark:border-zinc-800 xl:w-[380px] 2xl:w-[440px] shrink-0 ${selectedThreadId ? 'hidden xl:flex' : 'flex'}`}>
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:ring-1 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:bg-zinc-800 dark:focus:ring-zinc-700"
            />
          </div>
          {mode === "inbox" && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800">
                <Filter className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setFilter("all")}>All Emails</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("unread")}>Unread</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("starred")}>Starred</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("needsReply")}>Needs Reply</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("hasAttachments")}>Has Attachments</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("highPriority")}>High Priority</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isSyncing && (
          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 flex items-center justify-center gap-2 border-b border-blue-100 dark:border-blue-900/50">
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Syncing new emails...</span>
          </div>
        )}

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
              {filteredThreads.map((thread, index) => {
                const isUnread = !thread.emails[0]?.isRead;
                const isSelected = selectedThreadId === thread.id;
                const sender = getSenderInfo(thread);

                return (
                  <div
                    key={thread.id}
                    ref={index === filteredThreads.length - 1 ? lastElementRef : undefined}
                    onClick={() => {
                      setSelectedThreadId(thread.id);
                    }}
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
                        {decodeHtmlEntities(thread.emails[0]?.snippet)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {isFetchingMore && (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 ${selectedThreadId ? 'flex absolute inset-0 z-10 bg-white dark:bg-zinc-950 xl:relative xl:inset-auto xl:z-auto' : 'hidden xl:flex'}`}>
        {selectedThreadId ? (
          <ThreadViewer threadId={selectedThreadId} key={selectedThreadId} onClose={() => setSelectedThreadId(null)} />
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
