"use client";

import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import DOMPurify from "isomorphic-dompurify";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { useSocket } from "@/providers/SocketProvider";
import { useThreadCache } from "@/providers/ThreadCacheProvider";
import { DraftEditor } from "./DraftEditor";
import { Archive, Star, Trash2, Mail, MailOpen, ShieldAlert, MoreVertical, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { useAuth } from "@/providers/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface Email {
  id: string;
  subject: string;
  htmlBody: string | null;
  plainBody: string | null;
  receivedAt: string;
  isRead?: boolean;
  isSpam?: boolean;
  isDeleted?: boolean;
  participants: {
    emailAddress: string;
    displayName: string | null;
    role: string;
  }[];
  summary?: string;
  sentiment?: string;
  intent?: string;
  needsReply?: boolean;
  priority?: string;
  processingStatus?: string;
  labels?: any[];
  drafts?: any[];
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

function EmailCard({ email, isLast, id }: { email: Email; isLast: boolean; id?: string }) {
  const sender = email.participants.find(p => p.role === "SENDER");
  const to = email.participants.filter(p => p.role === "TO");
  const senderName = sender?.displayName || sender?.emailAddress || "Unknown";
  const color = getAvatarColor(senderName);
  const [isCollapsed, setIsCollapsed] = useState(!isLast);

  const cleanHtml = email.htmlBody
    ? DOMPurify.sanitize(email.htmlBody, { USE_PROFILES: { html: true } })
    : null;

  return (
    <div id={id} className="animate-fade-in rounded-xl border border-zinc-200/80 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/80">
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
          {email.processingStatus === "COMPLETED" && email.summary && (
            <div className="bg-orange-50/50 px-5 py-3 border-b border-orange-100/50 dark:bg-orange-500/5 dark:border-orange-500/10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">AI Summary</span>
                <div className="flex gap-1.5 ml-auto">
                  {email.intent && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold dark:bg-blue-900/30 dark:text-blue-400">
                      {email.intent}
                    </span>
                  )}
                  {email.sentiment && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${email.sentiment === 'POSITIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      email.sentiment === 'NEGATIVE' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                        'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                      {email.sentiment}
                    </span>
                  )}
                  {email.needsReply && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold dark:bg-amber-900/30 dark:text-amber-400">
                      Needs Reply
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{email.summary}</p>
            </div>
          )}
          {email.processingStatus === "PROCESSING" && (
            <div className="bg-blue-50/50 px-5 py-2 border-b border-blue-100/50 dark:bg-blue-500/5 dark:border-blue-500/10 flex items-center gap-2">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">AI Analysis in progress...</span>
            </div>
          )}
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
  const { user } = useAuth();
  const { getThread, updateThreadInCache, cache } = useThreadCache();
  const [thread, setThread] = useState<Thread | null>(() => cache[threadId] || null);
  const [isLoading, setIsLoading] = useState(!cache[threadId]);

  useEffect(() => {
    if (!threadId) return;

    const fetchThread = async () => {
      try {
        if (!cache[threadId]) setIsLoading(true);
        // Instant load if cached!
        const data = await getThread(threadId);
        setThread(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchThread();
  }, [threadId, getThread]);

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !threadId) return;

    const handleUpdate = (data: any) => {
      if (data.threadId === threadId || (data.result && !data.threadId)) {
        // Simple re-fetch to get new emails or AI fields
        api.get(`/gmail/threads/${threadId}`).then(res => {
          setThread(res.data.data);
          updateThreadInCache(threadId, res.data.data);
          // Do not clear optimisticSentText here! Wait for sync:completed!
        }).catch(() => { });
      }
    };

    const handleSyncComplete = () => {
      api.get(`/gmail/threads/${threadId}`).then(res => {
        setThread(res.data.data);
        updateThreadInCache(threadId, res.data.data);
        setOptimisticSentText(null);
      }).catch(() => { });
    };

    socket.on('analysis:started', handleUpdate);
    socket.on('analysis:completed', handleUpdate);
    socket.on('sync:completed', handleSyncComplete);
    socket.on('email:sent', handleUpdate);
    socket.on('thread:updated', handleUpdate);
    socket.on('email:read', handleUpdate);
    socket.on('email:unread', handleUpdate);
    socket.on('email:deleted', handleUpdate);
    socket.on('email:restored', handleUpdate);
    socket.on('email:spam', handleUpdate);
    socket.on('email:unspam', handleUpdate);

    return () => {
      socket.off('analysis:started', handleUpdate);
      socket.off('analysis:completed', handleUpdate);
      socket.off('sync:completed', handleSyncComplete);
      socket.off('email:sent', handleUpdate);
      socket.off('thread:updated', handleUpdate);
      socket.off('email:read', handleUpdate);
      socket.off('email:unread', handleUpdate);
      socket.off('email:deleted', handleUpdate);
      socket.off('email:restored', handleUpdate);
      socket.off('email:spam', handleUpdate);
      socket.off('email:unspam', handleUpdate);
    };
  }, [socket, threadId]);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    if (!thread || actionLoading) return;
    setActionLoading(action);
    try {
      await api.post(`/gmail/threads/${threadId}/${action}`);
      toast.success(`Action applied successfully`);
    } catch (e) {
      if (action === 'permanent') {
        try {
          await api.delete(`/gmail/threads/${threadId}/${action}`);
          toast.success(`Deleted permanently`);
        } catch (err) {
          toast.error(`Failed to apply action`);
        }
      } else {
        toast.error(`Failed to apply action`);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const [optimisticSentText, setOptimisticSentText] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the top of the last email
  useEffect(() => {
    if (thread && scrollContainerRef.current) {
      // Small delay to let the DOM render the emails first
      setTimeout(() => {
        const lastEmailElement = document.getElementById('last-email-card');
        if (lastEmailElement && scrollContainerRef.current) {
          // Scroll so the last email is at the top of the view, minus a little padding
          scrollContainerRef.current.scrollTop = lastEmailElement.offsetTop - 20;
        }
      }, 100);
    }
  }, [thread?.id, thread?.emails?.length]);

  if (isLoading) {
    return <ThreadSkeleton />;
  }

  if (!thread) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden animate-fade-in-scale">
      <div className="shrink-0 border-b border-zinc-200 bg-white/90 px-6 py-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {thread.subject || "(No Subject)"}
          </h2>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {thread.emails.length} message{thread.emails.length !== 1 ? "s" : ""} in this conversation
          </p>
        </div>
        <div className="flex items-center gap-2">
          {thread.emails[0]?.isSpam ? (
            <Button variant="ghost" size="sm" onClick={() => handleAction('unspam')} disabled={!!actionLoading} title="Not Spam">
              {actionLoading === 'unspam' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />} Not Spam
            </Button>
          ) : thread.emails[0]?.isDeleted ? (
            <Button variant="ghost" size="sm" onClick={() => handleAction('restore')} disabled={!!actionLoading} title="Restore">
              {actionLoading === 'restore' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Restore
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={() => handleAction('archive')} disabled={!!actionLoading} title="Archive">
                {actionLoading === 'archive' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              </Button>
              {thread.emails.some((e) => !e.isRead) ? (
                <Button variant="outline" size="sm" onClick={() => handleAction('read')} disabled={!!actionLoading} className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {actionLoading === 'read' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailOpen className="mr-2 h-4 w-4" />} Mark as Read
                </Button>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => handleAction('unread')} disabled={!!actionLoading} title="Mark unread">
                  {actionLoading === 'unread' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => handleAction('delete')} disabled={!!actionLoading} title="Trash">
                {actionLoading === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleAction('star')}>
                <Star className="mr-2 h-4 w-4" /> Star
              </DropdownMenuItem>
              {!thread.emails[0]?.isSpam && (
                <DropdownMenuItem onClick={() => handleAction('spam')}>
                  <ShieldAlert className="mr-2 h-4 w-4" /> Report Spam
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleAction('permanent')} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="space-y-3 p-5">
          {thread.emails.map((email, index) => (
            <EmailCard
              key={email.id}
              email={email}
              isLast={index === thread.emails.length - 1}
              id={index === thread.emails.length - 1 ? 'last-email-card' : undefined}
            />
          ))}

          {optimisticSentText && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 opacity-60 dark:border-zinc-800 dark:bg-zinc-900 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getAvatarColor(user?.name || user?.email || 'ME').bg} ${getAvatarColor(user?.name || user?.email || 'ME').text}`}>
                  {(user?.name || user?.email || 'ME').charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {user?.name || user?.email || 'You'}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Sending...</span>
                </div>
              </div>
              <div className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
                <p className="whitespace-pre-wrap">{optimisticSentText}</p>
              </div>
            </div>
          )}

          {!optimisticSentText && !thread.emails[0]?.isDeleted && (() => {
            // Helper: check if an email was sent BY the logged-in user
            const isEmailSentByUser = (email: Email) => {
              const sender = email.participants?.find((p: { role: string }) => p.role === 'SENDER');
              if (!sender) return false;
              // Check SENT label OR sender email matches logged-in user
              const hasSentLabel = email.labels?.some((l: { providerLabelId: string }) => l.providerLabelId === 'SENT');
              const senderMatchesUser = sender.emailAddress?.toLowerCase() === user?.email?.toLowerCase();
              return hasSentLabel || senderMatchesUser;
            };

            const lastEmail = thread.emails[thread.emails.length - 1];
            const isLastEmailByUser = isEmailSentByUser(lastEmail);

            // Find the latest email that was NOT sent by the user (i.e. the one we'd reply to)
            const latestReceivedEmail = [...thread.emails].reverse().find(e => !isEmailSentByUser(e));

            // Only show the AI draft if:
            // 1. The last email in the thread was NOT sent by the user (otherwise the conversation is waiting on the other person)
            // 2. The draft belongs to the latest received email specifically
            const draftFromLatest = !isLastEmailByUser && latestReceivedEmail?.drafts?.[0] || null;

            // The email we're replying to is the latest received email, or fallback to the last email
            const targetEmail = latestReceivedEmail || lastEmail;

            // Check if AI is currently processing this email (draft being generated)
            const isCurrentlyProcessing = targetEmail.processingStatus === 'PROCESSING' && !draftFromLatest;

            return (
              <DraftEditor
                emailId={targetEmail.id}
                threadId={thread.id}
                initialDraft={draftFromLatest}
                isProcessing={isCurrentlyProcessing}
                onSent={(text) => setOptimisticSentText(text)}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
}
