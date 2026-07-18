import React, { useState } from "react";
import api from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Trash2, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import * as Tooltip from '@radix-ui/react-tooltip';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComposeModal({ isOpen, onClose }: ComposeModalProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);

  const handleDiscard = () => {
    setTo("");
    setCc("");
    setBcc("");
    setSubject("");
    setBody("");
    setShowCcBcc(false);
    onClose();
  };

  const handleSend = () => {
    if (!to.trim()) {
      toast.error("Please specify at least one recipient");
      return;
    }
    if (!body.trim()) {
      toast.error("Message body cannot be empty");
      return;
    }
    if (subject.length > 900) {
      toast.error("Subject is too long");
      return;
    }

    const toArray = to.split(',').map(e => e.trim()).filter(Boolean);
    const ccArray = cc.split(',').map(e => e.trim()).filter(Boolean);
    const bccArray = bcc.split(',').map(e => e.trim()).filter(Boolean);

    // Optimistically close modal
    onClose();

    setIsSending(true);

    api.post("/gmail/send/compose", {
      to: toArray,
      cc: ccArray,
      bcc: bccArray,
      subject,
      body
    }).then(() => {
      toast.success("Message sent successfully");
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
      setShowCcBcc(false);
    }).catch((error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to send email");
    }).finally(() => {
      setIsSending(false);
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl w-full h-[100dvh] sm:h-[80vh] sm:max-h-[800px] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-xl shadow-2xl bg-white dark:bg-zinc-950 border-0 sm:border border-zinc-200 dark:border-zinc-800">
        <DialogHeader className="px-5 py-3 border-b border-zinc-300 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/20 flex flex-row items-center">
          <DialogTitle className="text-base font-semibold text-zinc-800 dark:text-zinc-200 m-0">New Message</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-5 py-2.5 flex items-center gap-3 border-b border-zinc-300 dark:border-zinc-800/60 group focus-within:bg-zinc-50/50 dark:focus-within:bg-zinc-900/30 transition-colors">
            <span className="text-sm font-medium text-zinc-500 w-10">To</span>
            <input
              autoFocus
              className="flex-1 bg-transparent border-none text-sm outline-none focus:ring-0 dark:text-zinc-100 placeholder:text-zinc-400"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="recipient@example.com"
            />
            {!showCcBcc && (
              <button 
                type="button" 
                onClick={() => setShowCcBcc(true)}
                className="cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cc/Bcc
              </button>
            )}
          </div>
          
          {showCcBcc && (
            <Tooltip.Provider delayDuration={100}>
              <div className="px-5 py-2.5 flex items-center gap-3 border-b border-zinc-300 dark:border-zinc-800/60 group focus-within:bg-zinc-50/50 dark:focus-within:bg-zinc-900/30 transition-colors">
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <span className="text-sm font-medium text-zinc-500 w-10 cursor-help transition-colors hover:text-zinc-800 dark:hover:text-zinc-300">
                      Cc
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content sideOffset={5} className="bg-white/95 dark:bg-zinc-950/95 border border-zinc-300 dark:border-zinc-800/80 p-3 rounded-xl shadow-xl flex flex-col gap-1.5 max-w-[280px] z-[9999] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
                      <p className="text-zinc-900 dark:text-zinc-200 font-semibold text-sm leading-tight">Carbon Copy</p>
                      <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed">Send a copy of the email to someone else so they are in the loop. Everyone can see who is in the Cc list.</p>
                      <Tooltip.Arrow className="fill-zinc-300 dark:fill-zinc-800/80" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
                <input
                  className="flex-1 bg-transparent border-none text-sm outline-none focus:ring-0 dark:text-zinc-100 placeholder:text-zinc-400"
                  value={cc}
                  onChange={e => setCc(e.target.value)}
                />
              </div>
              <div className="px-5 py-2.5 flex items-center gap-3 border-b border-zinc-300 dark:border-zinc-800/60 group focus-within:bg-zinc-50/50 dark:focus-within:bg-zinc-900/30 transition-colors relative">
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <span className="text-sm font-medium text-zinc-500 w-10 cursor-help transition-colors hover:text-zinc-800 dark:hover:text-zinc-300">
                      Bcc
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content sideOffset={5} className="bg-white/95 dark:bg-zinc-950/95 border border-zinc-300 dark:border-zinc-800/80 p-3 rounded-xl shadow-xl flex flex-col gap-1.5 max-w-[280px] z-[9999] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
                      <p className="text-zinc-900 dark:text-zinc-200 font-semibold text-sm leading-tight">Blind Carbon Copy</p>
                      <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed">Send a secret copy to someone. Nobody else receiving the email will know they received it.</p>
                      <Tooltip.Arrow className="fill-zinc-300 dark:fill-zinc-800/80" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
                <input
                  className="flex-1 bg-transparent border-none text-sm outline-none focus:ring-0 dark:text-zinc-100 placeholder:text-zinc-400 pr-24"
                  value={bcc}
                  onChange={e => setBcc(e.target.value)}
                />
                <Button 
                  type="button" 
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowCcBcc(false); setCc(''); setBcc(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-7 px-2.5 text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Remove
                </Button>
              </div>
            </Tooltip.Provider>
          )}

          <div className="px-5 py-2.5 flex items-center gap-3 border-b border-zinc-300 dark:border-zinc-800/60 group focus-within:bg-zinc-50/50 dark:focus-within:bg-zinc-900/30 transition-colors">
            <input
              className="flex-1 bg-transparent border-none text-sm outline-none focus:ring-0 font-semibold dark:text-zinc-100 placeholder:text-zinc-400 placeholder:font-medium"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </div>
          
          <div className="flex-1 p-5 flex flex-col group">
            <textarea
              className="flex-1 w-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message here..."
            />
          </div>
        </div>

        <div className="border-t border-zinc-300 dark:border-zinc-800 px-5 py-3.5 flex justify-between items-center bg-zinc-50/80 dark:bg-zinc-900/50 backdrop-blur-sm sm:rounded-b-xl">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleDiscard}
            className="text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors h-9 w-9"
            title="Discard Draft"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleSend} 
              disabled={isSending || !to.trim() || !body.trim()} 
              className={cn(
                "min-w-[110px] shadow-sm transition-all duration-200",
                "bg-orange-500 hover:bg-orange-600 text-white",
                "dark:bg-red-600 dark:hover:bg-red-500"
              )}
            >
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

