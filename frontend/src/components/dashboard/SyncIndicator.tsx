"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { useSocket } from "@/providers/SocketProvider";

interface SyncMetadata {
  status: "SYNCING" | "IDLE" | "ERROR";
  currentStage: string;
  emailsProcessed: number;
  totalEmailsEstimated: number;
}

interface SyncStatusResponse {
  connectionStatus: string;
  lastSuccessfulSyncAt: string | null;
  lastSyncError: string | null;
  activeSync: SyncMetadata | null;
}

export function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatusResponse | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const prevStatusRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const { socket } = useSocket();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get("/gmail/status");
      if (!mountedRef.current) return;

      const newStatus = res.data.data;
      setStatus(newStatus);
    } catch (e) {
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchStatus();

    if (!socket) return;

    const handleSyncStarted = (data: any) => {
      setStatus(prev => prev ? {
        ...prev,
        connectionStatus: "SYNCING",
        activeSync: {
          status: "SYNCING",
          currentStage: data.source === 'webhook' ? "Fetching new emails..." : "Syncing...",
          emailsProcessed: 0,
          totalEmailsEstimated: 0,
        }
      } : null);
    };

    const handleSyncCompleted = () => {
      fetchStatus();
    };

    socket.on('sync:started', handleSyncStarted);
    socket.on('sync:completed', handleSyncCompleted);

    return () => {
      mountedRef.current = false;
      socket.off('sync:started', handleSyncStarted);
      socket.off('sync:completed', handleSyncCompleted);
    };
  }, [fetchStatus, socket]);

  const handleManualSync = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    setStatus(prev => prev ? {
      ...prev,
      connectionStatus: "SYNCING",
      activeSync: {
        status: "SYNCING",
        currentStage: "Starting...",
        emailsProcessed: 0,
        totalEmailsEstimated: 0,
      }
    } : null);

    try {
      await api.post("/gmail/sync");
    } catch (e: any) {
      if (e?.response?.status !== 409) {
        isSyncingRef.current = false;
        fetchStatus();
      }
    }
  };

  const handleStopSync = async () => {
    setStatus(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        connectionStatus: "IDLE",
        activeSync: prev.activeSync ? { ...prev.activeSync, status: "IDLE" } : null
      };
    });
    isSyncingRef.current = false;
    window.dispatchEvent(new CustomEvent('sync-completed'));

    try {
      await api.post("/gmail/sync/stop");
    } catch (e) {
    }
  };

  if (!status) return null;

  const isSyncing = status.activeSync?.status === "SYNCING" || status.connectionStatus === "SYNCING";
  const hasError = status.connectionStatus === "ERROR" || status.activeSync?.status === "ERROR";

  return (
    <div
      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isSyncing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
          {isHovered ? (
            <button
              onClick={handleStopSync}
              className="ml-2 flex items-center gap-1 text-red-500 hover:text-red-600 font-medium"
            >
              Stop Sync
            </button>
          ) : (
          <span className="hidden sm:inline text-zinc-600 dark:text-zinc-400">
              {status.activeSync?.currentStage || "Syncing..."}
              {status.activeSync && status.activeSync.totalEmailsEstimated > 0 && (
                <span className="ml-1 text-xs">
                  ({status.activeSync.emailsProcessed}/{status.activeSync.totalEmailsEstimated})
                </span>
              )}
            </span>
          )}
        </>
      ) : hasError ? (
        <>
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="hidden sm:inline text-red-500">Sync Error</span>
          {isHovered && (
            <button
              onClick={handleManualSync}
              className="ml-2 flex items-center gap-1 text-red-500 hover:text-red-600"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          )}
        </>
      ) : (
        <>
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <span className="hidden sm:inline text-zinc-600 dark:text-zinc-400">Up to date</span>
        </>
      )}
    </div>
  );
}

