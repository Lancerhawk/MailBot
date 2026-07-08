import React, { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useSocket } from "@/providers/SocketProvider";
import { Button } from "../ui/button";
import { Sparkles, Send, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";

interface Draft {
  id: string;
  generatedText: string;
  editedText: string | null;
  confidence: number;
  createdAt: string;
}

export function DraftEditor({ emailId, threadId, initialDraft, onSent }: { emailId: string; threadId: string; initialDraft?: Draft | null; onSent?: (text: string) => void }) {
  const [draft, setDraft] = useState<Draft | null>(initialDraft || null);
  const [text, setText] = useState(initialDraft?.editedText ?? initialDraft?.generatedText ?? "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isManualReply, setIsManualReply] = useState(false);
  const { socket } = useSocket();

  // Initial draft is set from props. Socket handles live updates.

  useEffect(() => {
    if (!socket) return;

    const handleStarted = (data: any) => {
      if (data.emailId === emailId) setIsGenerating(true);
    };

    const handleGenerated = (data: any) => {
      if (data.emailId === emailId) {
        setIsGenerating(false);
        setDraft(data.draft);
        setText(data.draft.editedText ?? data.draft.generatedText);
      }
    };

    const handleFailed = (data: any) => {
      if (data.emailId === emailId) {
        setIsGenerating(false);
        toast.error("Draft generation failed: " + data.error);
      }
    };

    const handleSent = (data: any) => {
      // The optimistic UI update in handleSend handles this now.
      // We just keep this listener to avoid race conditions.
    };

    const handleSendFailed = (data: any) => {
      if (data.emailId === emailId) {
        setIsSending(false);
        toast.error("Failed to send: " + data.error);
      }
    };

    socket.on('draft:started', handleStarted);
    socket.on('draft:generated', handleGenerated);
    socket.on('draft:regenerated', handleGenerated);
    socket.on('draft:failed', handleFailed);
    socket.on('email:sent', handleSent);
    socket.on('email:send_failed', handleSendFailed);

    return () => {
      socket.off('draft:started', handleStarted);
      socket.off('draft:generated', handleGenerated);
      socket.off('draft:regenerated', handleGenerated);
      socket.off('draft:failed', handleFailed);
      socket.off('email:sent', handleSent);
      socket.off('email:send_failed', handleSendFailed);
    };
  }, [socket, emailId]);

  // Auto-save logic
  useEffect(() => {
    if (!draft || !text) return;
    if (text === draft.editedText || text === draft.generatedText) return;

    const timer = setTimeout(async () => {
      try {
        setIsSaving(true);
        await api.put(`/drafts/${draft.id}`, { editedText: text });
      } catch (e) {
        console.error("Auto-save failed", e);
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [text, draft]);

  const handleRegenerate = async () => {
    try {
      setIsGenerating(true);
      await api.post(`/drafts/${emailId}/regenerate`);
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error("Draft is already regenerating.");
      } else {
        toast.error("Failed to trigger regeneration.");
        setIsGenerating(false);
      }
    }
  };

  const handleSend = () => {
    // Fire and forget optimistic update
    if (onSent) {
      onSent(text);
    }
    
    // Immediately hide the draft editor
    setDraft(null);
    setIsManualReply(false);
    setText("");

    api.post(`/gmail/send/reply`, { emailId, editedText: text })
      .then(() => {
        toast.success("Reply sent successfully!");
      })
      .catch((error: any) => {
        if (error.response?.status === 409) {
          toast.error("Already sending this draft.");
        } else {
          toast.error("Failed to send reply.");
        }
      });
  };

  const handleDiscard = async () => {
    if (!draft) return;
    try {
      await api.delete(`/drafts/${draft.id}`);
      setDraft(null);
    } catch (e) {
      toast.error("Failed to discard draft");
    }
  };

  if (isGenerating) {
    return (
      <div className="mt-4 animate-fade-in rounded-xl border border-orange-200 bg-orange-50/50 p-6 flex flex-col items-center justify-center gap-3 dark:border-orange-500/20 dark:bg-orange-500/5">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        <p className="text-sm font-medium text-orange-600 dark:text-orange-400">AI is crafting a reply...</p>
      </div>
    );
  }

  if (!draft && !isManualReply) {
    return (
      <div className="mt-4 flex items-center justify-end">
        <Button onClick={() => setIsManualReply(true)} variant="outline" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
          <Send className="mr-2 h-4 w-4" /> Reply Manually
        </Button>
      </div>
    );
  }

  return (
    <div className={`mt-4 animate-fade-in rounded-xl border bg-white shadow-sm overflow-hidden ${draft ? 'border-orange-200 dark:border-orange-500/20' : 'border-zinc-200 dark:border-zinc-800'} dark:bg-zinc-900/80`}>
      {draft && (
        <div className="flex items-center justify-between border-b border-orange-100 bg-orange-50/50 px-4 py-3 dark:border-orange-900/30 dark:bg-orange-500/5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">AI Draft Reply</span>
            {isSaving && <span className="text-[10px] text-orange-400">Saving...</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={isSending} className="text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Regenerate
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDiscard} className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Discard
            </Button>
          </div>
        </div>
      )}
      {!draft && (
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-zinc-500" />
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Manual Reply</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setIsManualReply(false); setText(""); }} disabled={isSending}>
            Cancel
          </Button>
        </div>
      )}
      <div className="p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isSending}
          className="min-h-[150px] w-full resize-y rounded-lg border-none bg-transparent text-sm leading-relaxed outline-none focus:ring-0 text-zinc-800 dark:text-zinc-200"
          placeholder="Write your reply here..."
        />
        <div className="mt-4 flex items-center justify-end">
          <Button onClick={handleSend} disabled={isSending || !text.trim()} className={draft ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {isSending ? 'Sending...' : 'Send Reply'}
          </Button>
        </div>
      </div>
    </div>
  );
}
