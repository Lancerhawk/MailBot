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
    const idsToFetch = threadIds.filter(id => !cacheRef.current[id] && !promisesRef.current[id]);
    if (idsToFetch.length === 0) return;

    const promise = api.post('/gmail/threads/bulk', { threadIds: idsToFetch }).then(res => {
      const threads = res.data.data;
      
      const newCache = { ...cacheRef.current };
      for (const thread of threads) {
        if (thread && thread.id) {
          newCache[thread.id] = thread;
          cacheRef.current[thread.id] = thread;
        }
      }
      setCache(newCache);
      
      for (const id of idsToFetch) {
        delete promisesRef.current[id];
      }
      return threads;
    }).catch(e => {
      for (const id of idsToFetch) {
        delete promisesRef.current[id];
      }
      console.error(`Failed to prefetch threads bulk`, e);
    });

    for (const id of idsToFetch) {
      promisesRef.current[id] = promise;
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
