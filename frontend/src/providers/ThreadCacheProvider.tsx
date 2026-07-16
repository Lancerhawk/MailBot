"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import api from "@/lib/api";

interface ThreadCacheContextType {
  getThread: (threadId: string) => Promise<unknown>;
  prefetchThreads: (threadIds: string[]) => void;
  updateThreadInCache: (threadId: string, data: unknown) => void;
  cache: Record<string, unknown>;
}

const ThreadCacheContext = createContext<ThreadCacheContextType | undefined>(undefined);

export function ThreadCacheProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<Record<string, unknown>>({});
  const cacheRef = useRef<Record<string, unknown>>({});
  const promisesRef = useRef<Record<string, Promise<unknown> | undefined>>({});

  const getThread = useCallback(async (threadId: string) => {
    if (cacheRef.current[threadId]) {
      return cacheRef.current[threadId];
    }

    if (promisesRef.current[threadId]) {
      return promisesRef.current[threadId];
    }

    const promise = api.get(`/gmail/threads/${threadId}`).then(res => {
      const data = res.data.data;
      cacheRef.current[threadId] = data;
      setCache(prev => ({ ...prev, [threadId]: data }));
      delete promisesRef.current[threadId];
      return data;
    }).catch(e => {
      delete promisesRef.current[threadId];
      console.error(`Failed to fetch thread ${threadId}`, e);
      throw e;
    });

    promisesRef.current[threadId] = promise;
    return promise;
  }, []);

  const prefetchThreads = useCallback(async (threadIds: string[]) => {
    for (const threadId of threadIds) {
      if (cacheRef.current[threadId] || promisesRef.current[threadId]) {
        continue;
      }

      const promise = api.get(`/gmail/threads/${threadId}`).then(res => {
        const data = res.data.data;
        cacheRef.current[threadId] = data;
        setCache(prev => ({ ...prev, [threadId]: data }));
        delete promisesRef.current[threadId];
        return data;
      }).catch(e => {
        delete promisesRef.current[threadId];
        console.error(`Failed to prefetch thread ${threadId}`, e);
        throw e;
      });
      
      promisesRef.current[threadId] = promise;

      try {
        await promise;
        await new Promise(r => setTimeout(r, 50));
      } catch {
      }
    }
  }, []);

  const updateThreadInCache = useCallback((threadId: string, data: unknown) => {
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
