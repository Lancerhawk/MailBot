"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import DOMPurify from "isomorphic-dompurify";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";

interface Email {
  id: string;
  subject: string;
  htmlBody: string | null;
  plainBody: string | null;
  receivedAt: string;
  participants: {
    emailAddress: string;
    displayName: string | null;
    role: string;
  }[];
}

interface Thread {
  id: string;
  subject: string;
  emails: Email[];
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
    <div className="flex h-full w-full flex-col animate-fade-in">
      <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/3" />
      </div>
      <div className="flex-1 p-6">
        <div className="space-y-5">
          {Array.from({ length: 1 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="ml-auto">
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmailCard({ email, isLast }: { email: Email; isLast: boolean }) {
  const sender = email.participants.find(p => p.role === "SENDER");
  const to = email.participants.filter(p => p.role === "TO");
  const senderName = sender?.displayName || sender?.emailAddress || "Unknown";
  const color = getAvatarColor(senderName);
  const [isCollapsed, setIsCollapsed] = useState(!isLast);

  const cleanHtml = email.htmlBody
    ? DOMPurify.sanitize(email.htmlBody, { USE_PROFILES: { html: true } })
    : null;

  return (
    <div className="animate-fade-in rounded-xl border border-zinc-200/80 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/80">
      <div
        className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${color.bg} ${color.text}`}>
            {senderName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {sender?.displayName || sender?.emailAddress}
              </p>
              {sender?.displayName && (
                <span className="hidden text-xs text-zinc-400 sm:inline dark:text-zinc-500">
                  &lt;{sender.emailAddress}&gt;
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              to {to.map(t => t.displayName || t.emailAddress).join(", ")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {format(new Date(email.receivedAt), "MMM d, yyyy 'at' h:mm a")}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <div className="px-5 py-4 text-sm">
            {cleanHtml ? (
              <div
                className="email-body-content rounded-lg bg-white p-4 text-zinc-900 prose prose-sm max-w-none prose-a:text-orange-500 hover:prose-a:text-orange-600 prose-img:rounded-lg"
                style={{ colorScheme: "light" }}
                dangerouslySetInnerHTML={{ __html: cleanHtml }}
              />
            ) : (
              <div className="email-body-content whitespace-pre-wrap font-sans leading-relaxed text-zinc-800 dark:text-zinc-300">
                {email.plainBody || "This message has no content."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ThreadViewer({ threadId }: { threadId: string }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!threadId) return;

    const fetchThread = async () => {
      try {
        setIsLoading(true);
        setThread(null);
        const res = await api.get(`/gmail/threads/${threadId}`);
        setThread(res.data.data);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };

    fetchThread();
  }, [threadId]);

  if (isLoading) {
    return <ThreadSkeleton />;
  }

  if (!thread) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden animate-fade-in-scale">
      <div className="shrink-0 border-b border-zinc-200 bg-white/90 px-6 py-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90">
        <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {thread.subject || "(No Subject)"}
        </h2>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          {thread.emails.length} message{thread.emails.length !== 1 ? "s" : ""} in this conversation
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="space-y-3 p-5">
          {thread.emails.map((email, index) => (
            <EmailCard
              key={email.id}
              email={email}
              isLast={index === thread.emails.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
