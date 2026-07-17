"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload,
  Search,
  BookOpen,
  Database,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Loader2,
  Archive,
  ArchiveRestore,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { FolderNav } from "./FolderNav";
import { DocumentCard } from "./DocumentCard";
import { UploadModal } from "./UploadModal";
import { DocumentDetailsPanel } from "./DocumentDetailsPanel";
import { useSocket } from "@/providers/SocketProvider";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import { ChevronDown } from "lucide-react";

interface Stats {
  totalDocuments: number;
  embeddedCount: number;
  processingCount: number;
  failedCount: number;
  totalStorageBytes: number;
  maxStorageBytes: number;
  totalRetrievals: number;
  maxDocuments: number;
}

const FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
  { label: "Processing", value: "processing" },
  { label: "Failed", value: "failed" },
];

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "A → Z", value: "a-z" },
  { label: "Largest", value: "largest" },
  { label: "Most Retrieved", value: "most-retrieved" },
  { label: "Recently Used", value: "recently-used" },
];

function formatStorageSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

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

export function KnowledgeBase() {
  const [allDocuments, setAllDocuments] = useState<KnowledgeDocument[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState("All");
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeSort, setActiveSort] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailsDoc, setDetailsDoc] = useState<KnowledgeDocument | null>(null);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [isPageProcessing, setIsPageProcessing] = useState(false);

  const { socket } = useSocket();

  // ─── DATA FETCHING (one-shot, all docs) ────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [docsRes, statsRes] = await Promise.all([
        api.get("/knowledge", { params: { limit: 500 } }),
        api.get("/knowledge/stats"),
      ]);
      setAllDocuments(docsRes.data.data.documents);
      setStats(statsRes.data.data);
    } catch {
      toast.error("Failed to load documents");
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchAll().finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAll]);

  // ─── NAVBAR REFRESH LISTENER ─────────────────────────────

  useEffect(() => {
    const handleRefresh = () => {
      setTimeout(() => {
        setLoading(true);
        fetchAll().finally(() => setLoading(false));
      }, 0);
    };
    window.addEventListener("refresh-data", handleRefresh);
    return () => window.removeEventListener("refresh-data", handleRefresh);
  }, [fetchAll]);

  // ─── SOCKET LISTENERS ─────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const refresh = () => fetchAll();

    socket.on("knowledge:ready", refresh);
    socket.on("knowledge:failed", refresh);
    socket.on("knowledge:deleted", refresh);
    socket.on("knowledge:archived", refresh);
    socket.on("knowledge:restored", refresh);
    socket.on("knowledge:replaced", refresh);

    return () => {
      socket.off("knowledge:ready", refresh);
      socket.off("knowledge:failed", refresh);
      socket.off("knowledge:deleted", refresh);
      socket.off("knowledge:archived", refresh);
      socket.off("knowledge:restored", refresh);
      socket.off("knowledge:replaced", refresh);
    };
  }, [socket, fetchAll]);

  // ─── CLIENT-SIDE FILTERING, SORTING & SEARCH ─────────────

  const { documents, folderCounts } = React.useMemo(() => {
    // 1. Compute folder counts from ALL docs (before filtering)
    const counts: Record<string, number> = { All: allDocuments.length };
    for (const doc of allDocuments) {
      const folderKey = doc.folder || "Uncategorized";
      counts[folderKey] = (counts[folderKey] || 0) + 1;
    }

    // 2. Filter by folder
    let filtered = activeFolder === "All"
      ? allDocuments
      : allDocuments.filter((d) => d.folder === activeFolder);

    // 3. Filter by status
    switch (activeFilter) {
      case "active":
        filtered = filtered.filter((d) => !d.isArchived && d.processingStatus === "COMPLETED");
        break;
      case "archived":
        filtered = filtered.filter((d) => d.isArchived);
        break;
      case "processing":
        filtered = filtered.filter((d) => d.processingStatus === "PROCESSING" || d.processingStatus === "PENDING");
        break;
      case "failed":
        filtered = filtered.filter((d) => d.processingStatus === "FAILED");
        break;
    }

    // 4. Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((d) =>
        d.title?.toLowerCase().includes(q) ||
        d.originalFileName?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q)
      );
    }

    // 5. Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (activeSort) {
        case "newest":
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case "oldest":
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case "a-z":
          return (a.title || "").localeCompare(b.title || "");
        case "largest":
          return (b.fileSize || 0) - (a.fileSize || 0);
        case "most-retrieved":
          return (b.retrievalCount || 0) - (a.retrievalCount || 0);
        case "recently-used":
          return new Date(b.lastRetrievedAt || 0).getTime() - new Date(a.lastRetrievedAt || 0).getTime();
        default:
          return 0;
      }
    });

    return { documents: sorted, folderCounts: counts };
  }, [allDocuments, activeFolder, activeFilter, searchQuery, activeSort]);

  // ─── SELECTION ────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((d) => d.id)));
    }
  }, [documents, selectedIds.size]);

  // ─── BULK ACTIONS ─────────────────────────────────────────

  const handleBulkArchive = useCallback(async () => {
    setIsProcessingBulk(true);
    setIsPageProcessing(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => api.patch(`/knowledge/${id}/archive`)));
      toast.success(`${selectedIds.size} documents archived`);
      setSelectedIds(new Set());
      refreshAll();
    } catch {
      toast.error("Bulk archive failed");
    } finally {
      setIsProcessingBulk(false);
      setIsPageProcessing(false);
    }
  }, [selectedIds, refreshAll]);

  const handleBulkRestore = useCallback(async () => {
    setIsProcessingBulk(true);
    setIsPageProcessing(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => api.patch(`/knowledge/${id}/restore`)));
      toast.success(`${selectedIds.size} documents restored`);
      setSelectedIds(new Set());
      refreshAll();
    } catch {
      toast.error("Bulk restore failed");
    } finally {
      setIsProcessingBulk(false);
      setIsPageProcessing(false);
    }
  }, [selectedIds, refreshAll]);

  const handleBulkDelete = useCallback(async () => {
    setIsProcessingBulk(true);
    setIsPageProcessing(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => api.delete(`/knowledge/${id}`)));
      toast.success(`${selectedIds.size} documents deleted`);
      setSelectedIds(new Set());
      refreshAll();
    } catch {
      toast.error("Bulk delete failed");
    } finally {
      setIsProcessingBulk(false);
      setIsPageProcessing(false);
    }
  }, [selectedIds, refreshAll]);

  const storagePercent = stats ? Math.min(100, (stats.totalStorageBytes / stats.maxStorageBytes) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 h-full relative">
      {isPageProcessing && (
        <div className="fixed inset-0 z-[200] cursor-wait">
          <div className="absolute inset-x-0 top-0 h-1 overflow-hidden rounded-full bg-orange-200 dark:bg-orange-500/20">
            <div className="h-full w-2/5 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-orange-400 via-orange-500 to-orange-400" />
          </div>
        </div>
      )}
      {/* ─── HEADER ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Knowledge Base
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage documents the AI uses to draft smarter email replies.
          </p>
          <p className="mt-2 text-xs font-medium text-orange-600 dark:text-orange-400">
            <AlertCircle className="inline-block mr-1 h-3 w-3 -mt-0.5" />
            Note: There is a strict safety limit of 2000 chunks (~200 dense pages) and 50MB per document. Larger files will fail.
          </p>
          <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 p-2 text-left text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 max-w-2xl">
            <AlertCircle className="mt-0 h-4 w-4 shrink-0" />
            <p>
              <strong>Hardware Constraint:</strong> This entire project (AI Model + Database + API) is deployed on a single 1GB RAM instance. Uploading large files will take several minutes to process and may temporarily slow down the application.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Storage bar */}
          {stats && (
            <div className="hidden items-center gap-2 sm:flex">
              <div className="w-28">
                <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
                  <span>{formatStorageSize(stats.totalStorageBytes)}</span>
                  <span>{formatStorageSize(stats.maxStorageBytes)}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <motion.div
                    className={cn(
                      "h-full rounded-full transition-colors",
                      storagePercent > 90 ? "bg-red-500" : storagePercent > 70 ? "bg-amber-500" : "bg-emerald-500"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${storagePercent}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {stats.totalDocuments}/{stats.maxDocuments} docs
              </span>
            </div>
          )}

          <Button
            onClick={() => setShowUpload(true)}
            className="bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Database}
          label="Total Documents"
          value={stats?.totalDocuments}
          loading={loading}
          accent="bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          icon={CheckCircle2}
          label="Processed"
          value={stats?.embeddedCount}
          loading={loading}
          accent="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          icon={AlertCircle}
          label="Processing / Failed"
          value={stats ? `${stats.processingCount} / ${stats.failedCount}` : undefined}
          loading={loading}
          accent={stats && stats.failedCount > 0 ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400" : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"}
        />
        <StatCard
          icon={BarChart3}
          label="Total Retrievals"
          value={stats?.totalRetrievals}
          loading={loading}
          accent="bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* ─── BULK ACTION BAR ───────────────────────────────── */}
      <AnimatePresence initial={false}>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 dark:border-orange-800 dark:bg-orange-500/5"
          >
            <button
              onClick={selectAll}
              className="text-sm font-medium text-orange-700 hover:underline dark:text-orange-400"
            >
              {selectedIds.size === documents.length ? "Deselect all" : "Select all"}
            </button>
            <span className="text-sm text-orange-600 dark:text-orange-400">
              {selectedIds.size} selected
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkArchive} disabled={isProcessingBulk} className="cursor-pointer">
                {isProcessingBulk ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Archive className="mr-1.5 h-3.5 w-3.5" />} Archive
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkRestore} disabled={isProcessingBulk} className="cursor-pointer">
                {isProcessingBulk ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />} Restore
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkDelete} disabled={isProcessingBulk} className="text-red-600 hover:bg-red-50 dark:text-red-400 cursor-pointer">
                {isProcessingBulk ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />} Delete
              </Button>
              <button onClick={() => setSelectedIds(new Set())} disabled={isProcessingBulk} className="ml-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── MAIN LAYOUT ──────────────────────────────────── */}
      <div className="flex flex-1 gap-6">
        {/* Sidebar */}
        <div className="hidden w-48 shrink-0 lg:block">
          <FolderNav
            activeFolder={activeFolder}
            onFolderChange={(f) => { setActiveFolder(f); setDetailsDoc(null); }}
            folderCounts={folderCounts}
          />
        </div>

        {/* Main content */}
        <div className="relative min-w-0 flex-1">
          {/* Filters bar */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-orange-400 focus:ring-1 focus:ring-orange-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Filter pills */}
              <div className="flex items-center gap-1 overflow-x-auto">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setActiveFilter(opt.value); }}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                      activeFilter === opt.value
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={activeSort}
                  onChange={(e) => { setActiveSort(e.target.value); }}
                  className="cursor-pointer appearance-none rounded-lg border border-zinc-300 bg-white px-2 py-1 pr-8 text-xs text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              </div>
            </div>
          </div>

          {/* Mobile folder selector */}
          <div className="mb-4 lg:hidden relative">
            <select
              value={activeFolder}
              onChange={(e) => { setActiveFolder(e.target.value); setDetailsDoc(null); }}
              className="cursor-pointer appearance-none w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {Object.entries(folderCounts).map(([name, count]) => (
                <option key={name} value={name}>{name} ({count})</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>

          {/* Document grid */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No documents found"
              description={
                searchQuery
                  ? "No documents match your search. Try a different query."
                  : "Upload your first document to give the AI knowledge for drafting emails."
              }
              action={
                !searchQuery ? (
                  <Button
                    onClick={() => setShowUpload(true)}
                    className="bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600"
                  >
                    <Upload className="mr-2 h-4 w-4" /> Upload Document
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence>
                  {documents.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      isSelected={selectedIds.has(doc.id)}
                      onSelect={toggleSelect}
                      onUpdate={refreshAll}
                      onDetailsOpen={(d) => setDetailsDoc(d)}
                      onProcessingChange={setIsPageProcessing}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── MODALS ────────────────────────────────────────── */}
      <UploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onUploadComplete={refreshAll}
      />

      <DocumentDetailsPanel
        document={detailsDoc}
        isOpen={!!detailsDoc}
        onClose={() => setDetailsDoc(null)}
        onUpdate={refreshAll}
        onProcessingChange={setIsPageProcessing}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  accent = "border-zinc-300 dark:border-zinc-800/80",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null | undefined;
  loading: boolean;
  accent?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border p-3 sm:p-4 shadow-md dark:shadow-xl bg-white dark:bg-zinc-900", accent)}>
      <div className="rounded-lg bg-black/5 p-2 dark:bg-white/10 shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        {loading ? (
          <Skeleton className="h-6 w-12" />
        ) : (
          <p className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tabular-nums truncate">
            {value ?? "—"}
          </p>
        )}
        <p className="text-xs opacity-80 truncate">{label}</p>
      </div>
    </div>
  );
}
