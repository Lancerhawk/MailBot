import React, { useState } from "react";
import api from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";

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
    }).catch((error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to send email");
    }).finally(() => {
      setIsSending(false);
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <DialogTitle className="text-lg">New Message</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="border-b border-zinc-100 px-4 py-2 flex items-center gap-2 dark:border-zinc-800">
            <span className="text-sm text-zinc-500 w-8">To</span>
            <input
              autoFocus
              className="flex-1 bg-transparent border-none text-sm outline-none focus:ring-0 dark:text-zinc-200"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>
          <div className="border-b border-zinc-100 px-4 py-2 flex items-center gap-2 dark:border-zinc-800">
            <span className="text-sm text-zinc-500 w-8">Cc</span>
            <input
              className="flex-1 bg-transparent border-none text-sm outline-none focus:ring-0 dark:text-zinc-200"
              value={cc}
              onChange={e => setCc(e.target.value)}
            />
          </div>
          <div className="border-b border-zinc-100 px-4 py-2 flex items-center gap-2 dark:border-zinc-800">
            <span className="text-sm text-zinc-500 w-8">Bcc</span>
            <input
              className="flex-1 bg-transparent border-none text-sm outline-none focus:ring-0 dark:text-zinc-200"
              value={bcc}
              onChange={e => setBcc(e.target.value)}
            />
          </div>
          <div className="border-b border-zinc-100 px-4 py-2 flex items-center gap-2 dark:border-zinc-800">
            <span className="text-sm text-zinc-500 w-8">Subj</span>
            <input
              className="flex-1 bg-transparent border-none text-sm outline-none focus:ring-0 font-medium dark:text-zinc-200"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>
          <div className="flex-1 p-4 flex flex-col">
            <textarea
              className="flex-1 w-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed dark:text-zinc-200"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message here..."
            />
          </div>
        </div>

        <div className="border-t border-zinc-100 p-3 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 dark:border-zinc-800 rounded-b-xl">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
          <Button onClick={handleSend} disabled={isSending || !to.trim() || !body.trim()} className="bg-orange-500 hover:bg-orange-600 text-white min-w-[100px]">
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

