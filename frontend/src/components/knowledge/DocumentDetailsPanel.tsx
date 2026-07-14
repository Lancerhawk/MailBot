"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  RefreshCw,
  Archive,
  ArchiveRestore,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileText,
  Calendar,
  HardDrive,
  Hash,
  Layers,
  BarChart3,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import api from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";

const FOLDERS = ["Personal", "Career", "Projects", "Business", "Finance", "Legal", "Education", "Other"];

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentDetailsPanelProps {
  document: any | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onProcessingChange?: (isProcessing: boolean) => void;
}

export function DocumentDetailsPanel({ document: doc, isOpen, onClose, onUpdate, onProcessingChange }: DocumentDetailsPanelProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const [editingFolder, setEditingFolder] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if clicking on a toast notification
      if ((e.target as Element).closest(".go3958317564, .go4109123758, ol[data-sonner-toaster]")) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener("click", handleClickOutside), 0);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (doc) {
      setTitleValue(doc.title || "");
      setDescValue(doc.description || "");
    }
  }, [doc]);

  const handleSaveTitle = useCallback(async () => {
    if (!doc || !titleValue.trim()) return;
    try {
      await api.patch(`/knowledge/${doc.id}`, { title: titleValue });
      setEditingTitle(false);
      onUpdate();
    } catch {
      toast.error("Failed to update title");
    }
  }, [doc, titleValue, onUpdate]);

  const handleSaveDescription = useCallback(async () => {
    if (!doc) return;
    try {
      await api.patch(`/knowledge/${doc.id}`, { description: descValue });
      setEditingDescription(false);
      onUpdate();
    } catch {
      toast.error("Failed to update description");
    }
  }, [doc, descValue, onUpdate]);

  const handleFolderChange = useCallback(async (folder: string) => {
    if (!doc) return;
    try {
      await api.patch(`/knowledge/${doc.id}`, { folder });
      setEditingFolder(false);
      onUpdate();
    } catch {
      toast.error("Failed to move document");
    }
  }, [doc, onUpdate]);

  const handleDownload = useCallback(async () => {
    if (!doc) return;
    try {
      const res = await api.get(`/knowledge/download/${doc.id}`);
      window.location.href = res.data.data.url;
    } catch {
      toast.error("Failed to generate download link");
    }
  }, [doc]);

  const handleArchiveToggle = useCallback(async () => {
    if (!doc) return;
    onProcessingChange?.(true);
    try {
      if (doc.isArchived) {
        await api.patch(`/knowledge/${doc.id}/restore`);
        toast.success("Document restored");
      } else {
        await api.patch(`/knowledge/${doc.id}/archive`);
        toast.success("Document archived");
      }
      onUpdate();
    } catch {
      toast.error("Action failed");
    } finally {
      onProcessingChange?.(false);
    }
  }, [doc, onUpdate, onProcessingChange]);

  const handleDelete = useCallback(async () => {
    if (!doc) return;
    onProcessingChange?.(true);
    try {
      await api.delete(`/knowledge/${doc.id}`);
      toast.success("Document deleted");
      onClose();
      onUpdate();
    } catch {
      toast.error("Failed to delete document");
    } finally {
      onProcessingChange?.(false);
    }
  }, [doc, onClose, onUpdate, onProcessingChange]);

  const handleRetry = useCallback(async () => {
    if (!doc) return;
    onProcessingChange?.(true);
    try {
      await api.patch(`/knowledge/${doc.id}/retry`);
      toast.info("Retrying processing...");
      onUpdate();
    } catch {
      toast.error("Failed to retry");
    } finally {
      onProcessingChange?.(false);
    }
  }, [doc, onUpdate, onProcessingChange]);

  if (!doc) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-zinc-950/30 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Document Details</h2>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-5">
                {/* Title */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400 dark:text-zinc-500">Title</label>
                  {editingTitle ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={titleValue}
                        onChange={(e) => setTitleValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                        className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-orange-400 dark:border-zinc-700 dark:text-zinc-100"
                      />
                      <Button size="sm" onClick={handleSaveTitle}>Save</Button>
                    </div>
                  ) : (
                    <p
                      className="cursor-pointer text-sm font-medium text-zinc-900 transition-colors hover:text-orange-600 dark:text-zinc-100 dark:hover:text-orange-400"
                      onClick={() => setEditingTitle(true)}
                    >
                      {doc.title}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400 dark:text-zinc-500">Description</label>
                  {editingDescription ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        autoFocus
                        value={descValue}
                        onChange={(e) => setDescValue(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-orange-400 dark:border-zinc-700 dark:text-zinc-100"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingDescription(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSaveDescription}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className="cursor-pointer text-sm text-zinc-600 transition-colors hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-400"
                      onClick={() => setEditingDescription(true)}
                    >
                      {doc.description || "Click to add description"}
                    </p>
                  )}
                </div>

                {/* Folder */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400 dark:text-zinc-500">Folder</label>
                  {editingFolder ? (
                    <select
                      autoFocus
                      value={doc.folder}
                      onChange={(e) => handleFolderChange(e.target.value)}
                      onBlur={() => setEditingFolder(false)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-orange-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      {FOLDERS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:border-orange-400"
                      onClick={() => setEditingFolder(true)}
                    >
                      {doc.folder}
                    </Badge>
                  )}
                </div>

                <hr className="border-zinc-200 dark:border-zinc-800" />

                {/* Metadata grid */}
                <div className="space-y-3">
                  <MetaRow icon={FileText} label="Original File" value={doc.originalFileName || "—"} />
                  <MetaRow icon={FileText} label="Type" value={`${doc.fileType} (${doc.mimeType || "—"})`} />
                  <MetaRow icon={HardDrive} label="File Size" value={formatFileSize(doc.fileSize)} />
                  <MetaRow icon={Hash} label="Version" value={`v${doc.version}`} />
                  <MetaRow icon={Hash} label="SHA-256" value={doc.fileHash ? doc.fileHash.substring(0, 16) + "..." : "—"} mono />
                  <MetaRow icon={HardDrive} label="Storage" value={doc.storageProvider || "S3"} />

                  <hr className="border-zinc-200 dark:border-zinc-800" />

                  <MetaRow
                    icon={doc.processingStatus === "COMPLETED" ? CheckCircle2 : doc.processingStatus === "FAILED" ? AlertCircle : Loader2}
                    label="Processing"
                    value={doc.processingStatus}
                    valueColor={
                      doc.processingStatus === "COMPLETED" ? "text-emerald-600 dark:text-emerald-400" :
                        doc.processingStatus === "FAILED" ? "text-red-600 dark:text-red-400" :
                          "text-blue-600 dark:text-blue-400"
                    }
                  />
                  <MetaRow icon={Archive} label="Archived" value={doc.isArchived ? "Yes" : "No"} />
                  <MetaRow icon={Layers} label="Chunks" value={doc.chunkCount?.toString() || "0"} />
                  <MetaRow icon={BarChart3} label="Retrievals" value={doc.retrievalCount?.toString() || "0"} />

                  <hr className="border-zinc-200 dark:border-zinc-800" />

                  <MetaRow icon={Calendar} label="Uploaded" value={doc.createdAt ? format(new Date(doc.createdAt), "PPpp") : "—"} />
                  <MetaRow icon={Clock} label="Processed" value={doc.processedAt ? format(new Date(doc.processedAt), "PPpp") : "—"} />
                  <MetaRow icon={Clock} label="Embedded" value={doc.embeddedAt ? format(new Date(doc.embeddedAt), "PPpp") : "—"} />
                  <MetaRow icon={Clock} label="Last Retrieved" value={doc.lastRetrievedAt ? formatDistanceToNow(new Date(doc.lastRetrievedAt), { addSuffix: true }) : "Never"} />

                  {doc.processingError && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-500/5">
                      <p className="text-xs font-medium text-red-700 dark:text-red-400">Processing Error</p>
                      <p className="mt-1 text-xs text-red-600 dark:text-red-300">{doc.processingError}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download
              </Button>
              {doc.processingStatus === "FAILED" && (
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleArchiveToggle}>
                {doc.isArchived ? (
                  <><ArchiveRestore className="mr-1.5 h-3.5 w-3.5" /> Restore</>
                ) : (
                  <><Archive className="mr-1.5 h-3.5 w-3.5" /> Archive</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  mono,
  valueColor,
}: {
  icon: any;
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{label}</p>
        <p className={cn(
          "mt-0.5 text-sm break-all",
          valueColor || "text-zinc-700 dark:text-zinc-300",
          mono && "font-mono text-xs"
        )}>
          {value}
        </p>
      </div>
    </div>
  );
}
