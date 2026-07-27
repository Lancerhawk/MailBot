"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  MoreVertical,
  Download,
  Pencil,
  FolderInput,
  RefreshCw,
  Archive,
  ArchiveRestore,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import api from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface KnowledgeDocument {
  id: string;
  title: string;
  description?: string;
  fileType?: string;
  originalFileName?: string;
  fileSize?: number;
  sizeBytes?: number;
  isArchived?: boolean;
  processingStatus?: string;
  processingError?: string;
  createdAt?: string;
  folder?: string;
  mimeType?: string;
  version?: number;
  fileHash?: string;
  storageProvider?: string;
  embeddedAt?: string;
  processedAt?: string;
  lastRetrievedAt?: string;
  retrievalCount?: number;
  chunkCount?: number;
  isEmbedded?: boolean;
  [key: string]: unknown;
}

interface DocumentCardProps {
  document: KnowledgeDocument;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: () => void;
  onDetailsOpen: (doc: KnowledgeDocument) => void;
  onProcessingChange?: (isProcessing: boolean) => void;
}

const FILE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  PDF: { icon: FileText, color: "text-red-500 dark:text-red-400" },
  DOCX: { icon: FileText, color: "text-blue-500 dark:text-blue-400" },
  DOC: { icon: FileText, color: "text-blue-500 dark:text-blue-400" },
  TXT: { icon: FileText, color: "text-zinc-500 dark:text-zinc-400" },
  MD: { icon: FileText, color: "text-zinc-500 dark:text-zinc-400" },
  CSV: { icon: FileSpreadsheet, color: "text-green-500 dark:text-green-400" },
  XLSX: { icon: FileSpreadsheet, color: "text-green-600 dark:text-green-400" },
  XLS: { icon: FileSpreadsheet, color: "text-green-600 dark:text-green-400" },
  PNG: { icon: FileImage, color: "text-purple-500 dark:text-purple-400" },
  JPEG: { icon: FileImage, color: "text-purple-500 dark:text-purple-400" },
  JPG: { icon: FileImage, color: "text-purple-500 dark:text-purple-400" },
  WEBP: { icon: FileImage, color: "text-purple-500 dark:text-purple-400" },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusConfig(doc: KnowledgeDocument) {
  if (doc.isArchived) {
    return { label: "Archived", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", icon: Archive };
  }
  switch (doc.processingStatus) {
    case "COMPLETED":
      return { label: "Ready", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400", icon: CheckCircle2 };
    case "PROCESSING":
      return { label: "Processing...", color: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400", icon: Loader2 };
    case "FAILED":
      return { label: "Failed", color: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400", icon: AlertCircle };
    case "PENDING":
      return { label: "Pending", color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400", icon: Loader2 };
    default:
      return { label: "Unknown", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", icon: File };
  }
}

export function DocumentCard({ document: doc, isSelected, onSelect, onUpdate, onDetailsOpen, onProcessingChange }: DocumentCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(doc.title);
  const [optimisticDoc, setOptimisticDoc] = useState(doc);
  const [isProcessing, setIsProcessing] = useState(false);

  const isGenerating = doc.processingStatus === "PROCESSING" || doc.processingStatus === "PENDING";

  const [prevDoc, setPrevDoc] = useState(doc);
  if (doc !== prevDoc) {
    setPrevDoc(doc);
    setOptimisticDoc(doc);
  }

  const fileInfo = FILE_ICONS[doc.fileType?.toUpperCase() || ""] || { icon: File, color: "text-zinc-400" };
  const FileIcon = fileInfo.icon;
  const status = getStatusConfig(optimisticDoc);
  const StatusIcon = status.icon;

  const handleRename = useCallback(async () => {
    if (!renameValue.trim() || renameValue === doc.title) {
      setIsRenaming(false);
      setRenameValue(doc.title);
      return;
    }

    const prevTitle = optimisticDoc.title;
    setOptimisticDoc((prev: KnowledgeDocument) => ({ ...prev, title: renameValue }));
    setIsRenaming(false);

    try {
      await api.patch(`/knowledge/${doc.id}`, { title: renameValue });
      onUpdate();
    } catch {
      setOptimisticDoc((prev: KnowledgeDocument) => ({ ...prev, title: prevTitle }));
      toast.error("Failed to rename document");
    }
  }, [renameValue, doc.id, doc.title, optimisticDoc.title, onUpdate]);

  const handleArchive = useCallback(async () => {
    setIsProcessing(true);
    onProcessingChange?.(true);
    const wasArchived = doc.isArchived;

    try {
      if (wasArchived) {
        await api.patch(`/knowledge/${doc.id}/restore`);
        toast.success("Document restored");
      } else {
        await api.patch(`/knowledge/${doc.id}/archive`);
        toast.success("Document archived");
      }
      onUpdate();
    } catch {
      toast.error(wasArchived ? "Failed to restore" : "Failed to archive");
    } finally {
      setIsProcessing(false);
      onProcessingChange?.(false);
    }
  }, [doc.id, doc.isArchived, onUpdate, onProcessingChange]);

  const handleDelete = useCallback(async () => {
    setIsProcessing(true);
    onProcessingChange?.(true);

    try {
      await api.delete(`/knowledge/${doc.id}`);
      toast.success("Document deleted");
      onUpdate();
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setIsProcessing(false);
      onProcessingChange?.(false);
    }
  }, [doc.id, onUpdate, onProcessingChange]);

  const handleRetry = useCallback(async () => {
    onProcessingChange?.(true);
    try {
      await api.patch(`/knowledge/${doc.id}/retry`);
      toast.info("Retrying processing...");
      onUpdate();
    } catch {
      toast.error("Failed to retry processing");
    } finally {
      onProcessingChange?.(false);
    }
  }, [doc.id, onUpdate, onProcessingChange]);

  const handleDownload = useCallback(async () => {
    try {
      const res = await api.get(`/knowledge/download/${doc.id}`);
      window.location.href = res.data.data.url;
    } catch {
      toast.error("Failed to get download link");
    }
  }, [doc.id]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        "group relative flex flex-col h-full rounded-xl border p-4 shadow-md transition-colors transition-shadow duration-200",
        "bg-white dark:bg-zinc-900/80 dark:shadow-xl",
        isSelected
          ? "border-orange-300 ring-2 ring-orange-200 dark:border-orange-600 dark:ring-orange-500/20"
          : "border-zinc-300 hover:border-zinc-400 hover:shadow-lg dark:border-zinc-800/80 dark:hover:border-zinc-700"
      )}
    >
      {isProcessing && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/50 backdrop-blur-[1px] dark:bg-zinc-900/50">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      )}
      <div className="flex items-start gap-3">
        <div
          className="relative mt-0.5 shrink-0 h-8 w-8 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onSelect(doc.id); }}
        >
          <div className={cn("absolute inset-0 transition-opacity flex items-center justify-center", isSelected ? "opacity-0" : "opacity-100 group-hover:opacity-0", fileInfo.color)}>
            <FileIcon className="h-8 w-8" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded border transition-all duration-200",
                isSelected
                  ? "border-orange-500 bg-orange-500 text-white dark:border-orange-400 opacity-100 scale-100"
                  : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100"
              )}
            >
              {isSelected && <Check className="h-3 w-3" />}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") { setIsRenaming(false); setRenameValue(doc.title); }
              }}
              className="w-full rounded border border-orange-300 bg-transparent px-1.5 py-0.5 text-sm font-semibold text-zinc-900 outline-none focus:ring-1 focus:ring-orange-400 dark:border-orange-600 dark:text-zinc-100"
            />
          ) : (
            <h3
              className="line-clamp-2 break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              onClick={() => onDetailsOpen(doc)}
              title={optimisticDoc.title}
            >
              {optimisticDoc.title}
            </h3>
          )}
          {doc.originalFileName && (
            <p className="mt-0.5 truncate text-xs text-zinc-400 dark:text-zinc-500" title={doc.originalFileName}>
              {doc.originalFileName}
            </p>
          )}
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="cursor-pointer shrink-0 rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-600 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={handleDownload} disabled={isGenerating}>
              <Download className="mr-2 h-4 w-4" /> Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setIsRenaming(true); setRenameValue(doc.title); }} disabled={isGenerating}>
              <Pencil className="mr-2 h-4 w-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDetailsOpen(doc)}>
              <FolderInput className="mr-2 h-4 w-4" /> Details
            </DropdownMenuItem>
            {doc.processingStatus === "FAILED" && (
              <DropdownMenuItem onClick={handleRetry}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleArchive} disabled={isGenerating}>
              {optimisticDoc.isArchived ? (
                <><ArchiveRestore className="mr-2 h-4 w-4" /> Restore</>
              ) : (
                <><Archive className="mr-2 h-4 w-4" /> Archive</>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Status + badges row */}
      <div className="mt-auto pt-4 flex flex-wrap items-center gap-1.5">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", status.color)}>
          <StatusIcon className={cn("h-3 w-3", doc.processingStatus === "PROCESSING" && "animate-spin")} />
          {status.label}
        </span>

        {(doc.version || 0) > 1 && (
          <Badge variant="outline" className="text-xs px-1.5 py-0">v{doc.version}</Badge>
        )}

        <Badge variant="outline" className="text-xs px-1.5 py-0">{doc.folder || "Uncategorized"}</Badge>
      </div>

      {/* Metadata */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500">
        <span className="whitespace-nowrap">{formatFileSize(doc.fileSize || 0)}</span>
        <span className="text-zinc-300 dark:text-zinc-700">•</span>
        <span className="whitespace-nowrap">{doc.createdAt ? formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true }) : "—"}</span>
        {(doc.chunkCount || 0) > 0 && (
          <>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="whitespace-nowrap">{doc.chunkCount} chunks</span>
          </>
        )}
      </div>

      {/* Retrieval stats */}
      <div className="mt-1.5 flex flex-row flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500">
        <span className="flex items-center gap-1 whitespace-nowrap">
          {doc.isEmbedded ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          ) : doc.processingStatus === "PROCESSING" ? (
            <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
          ) : null}
          {(doc.retrievalCount || 0) > 0
            ? `Used ${doc.retrievalCount}×`
            : doc.processingStatus === "PROCESSING"
              ? "Processing..."
              : doc.processingStatus === "PENDING"
                ? "Queued..."
                : "Never used"}
        </span>
        {doc.lastRetrievedAt && (
          <>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="whitespace-nowrap">Last: {formatDistanceToNow(new Date(doc.lastRetrievedAt), { addSuffix: true })}</span>
          </>
        )}
      </div>
    </motion.div>
  );
}
