"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import api from "@/lib/api";

interface ThreadCacheContextType {
  getThread: (threadId: string) => Promise<any>;
  prefetchThreads: (threadIds: string[]) => void;
  updateThreadInCache: (threadId: string, data: any) => void;
  cache: Record<string, any>;
}

const ThreadCacheContext = createContext<ThreadCacheContextType | undefined>(undefined);

export function ThreadCacheProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<Record<string, any>>({});
  const prefetchingRef = useRef<Set<string>>(new Set());
  const cacheRef = useRef<Record<string, any>>({}); // Keep a ref for instant synchronous access

  const getThread = useCallback(async (threadId: string) => {
    if (cacheRef.current[threadId]) {
      return cacheRef.current[threadId];
    }

    try {
      const res = await api.get(`/gmail/threads/${threadId}`);
      const data = res.data.data;
      cacheRef.current[threadId] = data;
      setCache(prev => ({ ...prev, [threadId]: data }));
      return data;
    } catch (e) {
      console.error(`Failed to fetch thread ${threadId}`, e);
      throw e;
    }
  }, []);

  const prefetchThreads = useCallback(async (threadIds: string[]) => {
    for (const threadId of threadIds) {
      if (cacheRef.current[threadId] || prefetchingRef.current.has(threadId)) {
        continue;
      }

      prefetchingRef.current.add(threadId);

      try {
        const res = await api.get(`/gmail/threads/${threadId}`);
        const data = res.data.data;
        cacheRef.current[threadId] = data;
        setCache(prev => ({ ...prev, [threadId]: data }));
        
        // Add a small 50ms delay to prevent overwhelming the DB connection pool
        await new Promise(r => setTimeout(r, 50));
      } catch (e) {
        console.error(`Failed to prefetch thread ${threadId}`, e);
      } finally {
        prefetchingRef.current.delete(threadId);
      }
    }
  }, []);

  const updateThreadInCache = useCallback((threadId: string, data: any) => {
    cacheRef.current[threadId] = data;
    setCache(prev => ({ ...prev, [threadId]: data }));
  }, []);

  return (
    <ThreadCacheContext.Provider value={{ getThread, prefetchThreads, updateThreadInCache, cache }}>
      {children}
    </ThreadCacheContext.Provider>
  );
}

export function useThreadCache() {
  const context = useContext(ThreadCacheContext);
  if (!context) {
    throw new Error("useThreadCache must be used within a ThreadCacheProvider");
  }
  return context;
}
