"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  X,
  FileText,
  Check,
  Loader2,
  AlertCircle,
  CloudUpload,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSocket } from "@/providers/SocketProvider";
import api from "@/lib/api";
import { toast } from "@/lib/toast";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const FOLDERS = ["Personal", "Career", "Projects", "Business", "Finance", "Legal", "Education", "Other"];

type UploadStage =
  | "queued"
  | "uploading"
  | "uploaded"
  | "parsing"
  | "chunking"
  | "embedding"
  | "ready"
  | "failed";

interface QueuedFile {
  id: string;
  file: File;
  stage: UploadStage;
  error?: string;
  documentId?: string;
}

const STAGE_LABELS: Record<UploadStage, string> = {
  queued: "Queued",
  uploading: "Uploading...",
  uploaded: "Uploaded",
  parsing: "Extracting text...",
  chunking: "Chunking...",
  embedding: "Generating embeddings...",
  ready: "Complete",
  failed: "Failed",
};

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

export function UploadModal({ isOpen, onClose, onUploadComplete }: UploadModalProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [folder, setFolder] = useState("Personal");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { socket } = useSocket();

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Small timeout to allow the exit animation to finish before clearing
      const t = setTimeout(() => {
        setQueue([]);
        setIsUploading(false);
        setFolder("Personal");
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Auto-close when all uploads succeed
  useEffect(() => {
    if (isOpen && queue.length > 0) {
      const allDone = queue.every(q => q.stage === "ready" || q.stage === "failed");
      const allSuccess = queue.every(q => q.stage === "ready");

      if (allDone && allSuccess) {
        const t = setTimeout(() => {
          onClose();
        }, 1500);
        return () => clearTimeout(t);
      }
    }
  }, [queue, isOpen, onClose]);

  // Listen for socket events to update processing status
  useEffect(() => {
    if (!socket) return;

    const handleEvent = (stage: UploadStage) => (data: any) => {
      setQueue((prev) =>
        prev.map((item) =>
          item.documentId === data.documentId
            ? { ...item, stage, error: data.error }
            : item
        )
      );
      if (stage === "ready" || stage === "failed") {
        onUploadComplete();
      }
    };

    socket.on("knowledge:parsing", handleEvent("parsing"));
    socket.on("knowledge:chunking", handleEvent("chunking"));
    socket.on("knowledge:embedding", handleEvent("embedding"));
    socket.on("knowledge:ready", handleEvent("ready"));
    socket.on("knowledge:failed", handleEvent("failed"));

    return () => {
      socket.off("knowledge:parsing");
      socket.off("knowledge:chunking");
      socket.off("knowledge:embedding");
      socket.off("knowledge:ready");
      socket.off("knowledge:failed");
    };
  }, [socket, onUploadComplete]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: QueuedFile[] = [];
    for (const file of Array.from(files)) {
      // Client-side validation
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`Unsupported file type: ${file.name}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File too large: ${file.name} (max 25MB)`);
        continue;
      }

      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        stage: "queued",
      });
    }
    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleUploadAll = useCallback(async () => {
    const pending = queue.filter((q) => q.stage === "queued");
    if (pending.length === 0) return;

    setIsUploading(true);

    for (const item of pending) {
      // Mark as uploading
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, stage: "uploading" as UploadStage } : q))
      );

      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("folder", folder);

        const res = await api.post("/knowledge/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const documentId = res.data.data.id;

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, stage: "uploaded" as UploadStage, documentId } : q
          )
        );
      } catch (err: any) {
        const message = err.response?.data?.message || "Upload failed";
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, stage: "failed" as UploadStage, error: message } : q
          )
        );
      }
    }

    setIsUploading(false);
    onUploadComplete();
  }, [queue, folder, onUploadComplete]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const hasQueued = queue.some((q) => q.stage === "queued");
  const allDone = queue.length > 0 && queue.every((q) => q.stage === "ready" || q.stage === "failed");

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", duration: 0.3 }}
          className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Upload Documents</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                PDF, DOCX, TXT, CSV, XLSX, and images supported
              </p>
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all duration-200",
                isDragOver
                  ? "border-orange-400 bg-orange-50 dark:border-orange-500 dark:bg-orange-500/5"
                  : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-600"
              )}
            >
              <CloudUpload className={cn(
                "h-10 w-10 transition-colors",
                isDragOver ? "text-orange-500" : "text-zinc-400 dark:text-zinc-500"
              )} />
              <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {isDragOver ? "Drop files here" : "Drag & drop files or click to browse"}
              </p>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                Max 25MB per file
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Folder selector */}
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Folder
              </label>
              <div className="relative">
                <select
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  className="w-full appearance-none cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 outline-none transition-colors focus:border-orange-400 focus:ring-1 focus:ring-orange-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {FOLDERS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              </div>
            </div>

            {/* File queue */}
            {queue.length > 0 && (
              <div className="mt-4 max-h-48 space-y-2 overflow-y-auto">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {item.file.name}
                      </p>
                      <p className={cn(
                        "text-xs",
                        item.stage === "ready" ? "text-emerald-600 dark:text-emerald-400" :
                          item.stage === "failed" ? "text-red-600 dark:text-red-400" :
                            "text-zinc-400 dark:text-zinc-500"
                      )}>
                        {STAGE_LABELS[item.stage]}
                        {item.error && ` — ${item.error}`}
                      </p>
                    </div>
                    {item.stage === "ready" ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : item.stage === "failed" ? (
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                    ) : item.stage === "queued" ? (
                      <button onClick={() => removeFromQueue(item.id)} className="shrink-0 text-zinc-400 hover:text-zinc-600">
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <Button variant="outline" onClick={onClose}>
              {allDone ? "Close" : "Cancel"}
            </Button>
            {hasQueued && (
              <Button
                onClick={handleUploadAll}
                disabled={isUploading}
                className="bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600"
              >
                {isUploading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" /> Upload {queue.filter(q => q.stage === "queued").length} file{queue.filter(q => q.stage === "queued").length !== 1 ? "s" : ""}</>
                )}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
