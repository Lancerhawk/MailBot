import React from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Database, FileText, SearchCode, HardDrive } from 'lucide-react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';

interface KnowledgeAnalyticsData {
  aggregate: {
    _sum: {
      documentsUploaded: number;
      documentsEmbedded: number;
      knowledgeRetrievalCount: number;
      processingFailures: number;
    };
    _max: {
      storageUsedBytes: number | string;
    };
  };
  timeseries: {
    date: string;
    documentsUploaded: number;
    knowledgeRetrievalCount: number;
  }[];
}

interface KnowledgeAnalyticsTabProps {
  data?: KnowledgeAnalyticsData;
  isLoading: boolean;
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function KnowledgeAnalyticsTab({ data, isLoading }: KnowledgeAnalyticsTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800" />
      </div>
    );
  }

  const kpis = [
    {
      title: 'Total Assets',
      value: (data?.aggregate?._sum?.documentsUploaded || 0).toLocaleString(),
      icon: <Database className="w-5 h-5 text-indigo-400" />,
      color: 'bg-indigo-500/10 border-indigo-500/20',
      subtitle: `${data?.aggregate?._sum?.documentsEmbedded || 0} successfully vectorized`
    },
    {
      title: 'AI Retrievals',
      value: (data?.aggregate?._sum?.knowledgeRetrievalCount || 0).toLocaleString(),
      icon: <SearchCode className="w-5 h-5 text-blue-400" />,
      color: 'bg-blue-500/10 border-blue-500/20',
      subtitle: 'Knowledge base queries'
    },
    {
      title: 'Processing Failures',
      value: (data?.aggregate?._sum?.processingFailures || 0).toLocaleString(),
      icon: <FileText className="w-5 h-5 text-rose-400" />,
      color: 'bg-rose-500/10 border-rose-500/20',
      subtitle: 'Failed PDF/Text extractions'
    },
    {
      title: 'Storage Used',
      value: formatBytes(Number(data?.aggregate?._max?.storageUsedBytes || 0)),
      icon: <HardDrive className="w-5 h-5 text-zinc-400" />,
      color: 'bg-zinc-500/10 border-zinc-500/20',
      subtitle: 'Active document files'
    }
  ];

  const formattedTimeseries = (data?.timeseries || []).map(item => ({
    ...item,
    formattedDate: format(new Date(item.date), 'MMM d'),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`p-5 rounded-xl border border-zinc-300 dark:border-transparent flex flex-col justify-between ${kpi.color} hover:bg-opacity-20 transition-all cursor-default shadow-sm dark:shadow-none`}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-zinc-700 dark:text-zinc-300 font-medium text-sm">{kpi.title}</h3>
              <div className="p-2 rounded-lg bg-black/20 backdrop-blur-sm shadow-inner">
                {kpi.icon}
              </div>
            </div>
            <div>
              <div className="text-3xl font-semibold text-zinc-900 dark:text-white tracking-tight">{kpi.value}</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 font-medium">{kpi.subtitle}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950/50 shadow-sm"
      >
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Knowledge Utilization</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Daily document uploads vs AI retrieval queries</p>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedTimeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" strokeOpacity={0.2} />
              <XAxis dataKey="formattedDate" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                itemStyle={{ color: '#f4f4f5' }}
              />
              <Line type="monotone" dataKey="documentsUploaded" name="Uploads" stroke="#818cf8" strokeWidth={3} dot={{ r: 4, fill: '#818cf8', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="knowledgeRetrievalCount" name="Retrievals" stroke="#34d399" strokeWidth={3} dot={{ r: 4, fill: '#34d399', strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
