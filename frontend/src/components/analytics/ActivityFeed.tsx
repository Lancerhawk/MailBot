import React, { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, Mail, UserPlus, Database, AlertCircle, FileText, Bot } from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface ActivityLog {
  id: string;
  action: string;
  entityType?: string;
  createdAt: string;
}

export function ActivityFeed({ filterParams }: { filterParams?: Record<string, string> }) {
  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    queryKey: ['analytics-activity', filterParams],
    queryFn: async ({ pageParam = '' }) => {
      let url = `/analytics/activity${pageParam ? `?cursor=${pageParam}` : '?'}`;
      if (filterParams?.startDate) url += `&startDate=${filterParams.startDate}`;
      if (filterParams?.endDate) url += `&endDate=${filterParams.endDate}`;
      
      const res = await api.get(url);
      return res.data;
    },
    getNextPageParam: (lastPage: Record<string, unknown> | unknown[]) => {
      if (Array.isArray(lastPage)) return undefined; // Stale backend fallback
      return lastPage?.nextCursor || undefined;
    },
    initialPageParam: '',
    refetchInterval: 30000,
  });

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoading || isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  const getIcon = (action: string) => {
    switch (action) {
      case 'LOGIN': return <UserPlus className="w-4 h-4 text-zinc-400" />;
      case 'SETTINGS_CHANGE': return <Activity className="w-4 h-4 text-blue-400" />;
      case 'EMAIL_SENT': return <Mail className="w-4 h-4 text-emerald-400" />;
      case 'EMAIL_RECEIVED': return <Mail className="w-4 h-4 text-blue-400" />;
      case 'EMAIL_ANALYZED': return <Bot className="w-4 h-4 text-purple-400" />;
      case 'DRAFT_APPROVED': return <Bot className="w-4 h-4 text-orange-400" />;
      case 'DOCUMENT_EMBEDDED': return <Database className="w-4 h-4 text-indigo-400" />;
      case 'CONTACT_CREATED': return <UserPlus className="w-4 h-4 text-teal-400" />;
      case 'ORGANIZATION_CREATED': return <Database className="w-4 h-4 text-teal-600" />;
      case 'DATA_EXPORT': return <FileText className="w-4 h-4 text-purple-400" />;
      case 'SYSTEM_ERROR': return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <Activity className="w-4 h-4 text-zinc-500" />;
    }
  };

  const activities: ActivityLog[] = data?.pages.flatMap((page: Record<string, unknown> | unknown[]) => {
    if (Array.isArray(page)) return page as ActivityLog[];
    return (page?.data as ActivityLog[]) || [];
  }) || [];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800/80 rounded-xl overflow-hidden flex flex-col h-full shadow-sm dark:shadow-none"
    >
      <div className="p-5 border-b border-zinc-300 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/80 shrink-0 z-20 relative">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-200">All Activities</h3>
      </div>
      
      <div className="p-5 flex-1 overflow-y-auto custom-scrollbar relative z-10">
        {isLoading && activities.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            <Skeleton className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            <Skeleton className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ) : activities.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-zinc-500">
            No recent activity found.
          </div>
        ) : (
          <Tooltip.Provider delayDuration={100}>
            <div className="space-y-4">
              {activities.map((activity: ActivityLog, index: number) => {
                const isLast = activities.length === index + 1;
                const formattedAction = activity.action.replace(/_/g, ' ');
                const formattedDesc = activity.entityType ? `Action performed on ${activity.entityType}` : 'System activity logged.';
                const createdAtDate = new Date(activity.createdAt);

                return (
                  <div 
                    ref={isLast ? lastElementRef : null} 
                    key={activity.id} 
                    className="relative group"
                  >
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <div className="flex-1 min-w-0 p-4 rounded-xl border border-zinc-300 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/40 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors cursor-default text-left block w-full">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900 shadow-sm shrink-0 transition-colors group-hover:bg-white dark:group-hover:bg-zinc-800 group-hover:border-zinc-400 dark:group-hover:border-zinc-700 mt-0.5">
                              {getIcon(activity.action)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-zinc-900 dark:text-zinc-200 text-sm tracking-wide mb-0.5 leading-tight">
                                {formattedAction}
                              </div>
                              <time className="text-sm text-zinc-500 dark:text-zinc-400 block">
                                {formatDistanceToNow(createdAtDate, { addSuffix: true })}
                              </time>
                            </div>
                          </div>
                        </div>
                      </Tooltip.Trigger>
                      
                      <Tooltip.Portal>
                        <Tooltip.Content 
                          sideOffset={5} 
                          className="bg-white/95 dark:bg-zinc-950/95 border border-zinc-300 dark:border-zinc-800/80 p-3 lg:p-4 rounded-xl shadow-xl flex flex-col gap-1.5 min-w-[200px] max-w-[350px] z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                        >
                          <p className="text-zinc-900 dark:text-zinc-200 font-semibold text-sm leading-tight">{formattedAction}</p>
                          <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed">{formattedDesc}</p>
                          <p className="text-zinc-500 font-mono text-[10px] mt-1 pt-2 border-t border-zinc-300 dark:border-zinc-800/80">
                            {createdAtDate.toLocaleString()}
                          </p>
                          <Tooltip.Arrow className="fill-zinc-300 dark:fill-zinc-800/80" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </div>
                );
              })}
            
            {isFetchingNextPage && (
              <div className="relative flex items-center gap-4 opacity-50 p-4">
                 <div className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-800/80 bg-zinc-100 dark:bg-zinc-900 shrink-0" />
                 <Skeleton className="h-6 w-full rounded-md bg-zinc-100 dark:bg-zinc-800" />
              </div>
            )}
          </div>
          </Tooltip.Provider>
        )}
      </div>
    </motion.div>
  );
}
