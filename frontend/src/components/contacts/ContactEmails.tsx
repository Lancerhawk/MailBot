"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { ThreadViewer } from "@/components/dashboard/ThreadViewer";
import { Mail, InboxIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

function getSenderInfo(thread: EmailThread) {
  const lastEmail = thread.emails[0];
  if (!lastEmail) return { name: "Unknown", initial: "?", color: AVATAR_COLORS[0] };
  const sender = lastEmail.participants.find(p => p.role === "SENDER");
  const name = sender?.displayName || sender?.emailAddress?.split("@")[0] || "Unknown";
  const initial = name.charAt(0).toUpperCase();
  return { name, initial, color: getAvatarColor(name) };
}

export function ContactEmails({ contactEmail }: { contactEmail: string }) {
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchEmails = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/gmail/threads', {
          params: { search: contactEmail, limit: 50 }
        });
        if (mounted && response.data?.status === 'success') {
          setThreads(response.data.data.threads || []);
        }
      } catch (error) {
        console.error("Failed to fetch contact emails:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchEmails();
    return () => { mounted = false; };
  }, [contactEmail]);

  if (selectedThreadId) {
    return (
      <div className="flex flex-col h-[600px] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-950 relative">
        <div className="flex-1 overflow-hidden relative">
          <ThreadViewer threadId={selectedThreadId} onClose={() => setSelectedThreadId(null)} forceShowClose={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden min-h-[400px] flex flex-col">
      <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
          <Mail className="h-4 w-4 text-zinc-400" /> Conversation History
        </h3>
        <span className="text-xs text-zinc-500">{threads.length} emails found</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-4">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <InboxIcon className="h-6 w-6 text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-500">No emails found for this contact.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {threads.map((thread) => {
              const sender = getSenderInfo(thread);
              const isUnread = !thread.emails[0]?.isRead;

              return (
                <div
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className="group flex cursor-pointer items-start gap-4 px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <div className={cn("mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold", sender.color.bg, sender.color.text)}>
                    {sender.initial}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <p className={cn("truncate text-sm", isUnread ? "font-bold text-zinc-900 dark:text-zinc-100" : "font-medium text-zinc-700 dark:text-zinc-300")}>
                        {sender.name}
                        {thread.messageCount > 1 && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            {thread.messageCount} msgs
                          </span>
                        )}
                      </p>
                      <span className="text-xs text-zinc-400 shrink-0 ml-2">
                        {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={cn("truncate text-[13px] mb-1", isUnread ? "font-semibold text-zinc-800 dark:text-zinc-200" : "text-zinc-600 dark:text-zinc-400")}>
                      {thread.subject || "(No subject)"}
                    </p>
                    <p className="line-clamp-1 text-[13px] text-zinc-500 dark:text-zinc-500">
                      {decodeHtmlEntities(thread.emails[0]?.snippet)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
