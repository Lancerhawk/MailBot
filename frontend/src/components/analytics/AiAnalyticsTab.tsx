import React from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, Sparkles, Zap, Coins } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';

interface AiAnalyticsData {
  aggregate: {
    _sum: {
      draftsGenerated: number;
      draftsApproved: number;
      draftsRejected: number;
      totalPromptTokens: number;
      totalCompletionTokens: number;
      estimatedCost: number;
    };
    _avg: {
      averageConfidence: number;
      averageLatency: number;
    };
  };
  timeseries: {
    date: string;
    draftsGenerated: number;
    draftsApproved: number;
    estimatedCost: number;
  }[];
}

interface AiAnalyticsTabProps {
  data?: AiAnalyticsData;
  isLoading: boolean;
}

export function AiAnalyticsTab({ data, isLoading }: AiAnalyticsTabProps) {
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
      title: 'Total Tokens Used',
      value: ((data?.aggregate?._sum?.totalPromptTokens || 0) + (data?.aggregate?._sum?.totalCompletionTokens || 0)).toLocaleString(),
      icon: <Brain className="w-5 h-5 text-indigo-400" />,
      color: 'bg-indigo-500/10 border-indigo-500/20',
      subtitle: `${(data?.aggregate?._sum?.totalCompletionTokens || 0).toLocaleString()} completion tokens`
    },
    {
      title: 'Estimated AI Cost',
      value: `$${(Number(data?.aggregate?._sum?.estimatedCost || 0)).toFixed(4)}`,
      icon: <Coins className="w-5 h-5 text-amber-400" />,
      color: 'bg-amber-500/10 border-amber-500/20',
      subtitle: 'Based on standard model pricing'
    },
    {
      title: 'Draft Approval Rate',
      value: data?.aggregate?._sum?.draftsGenerated 
        ? `${Math.round(((data?.aggregate?._sum?.draftsApproved || 0) / data.aggregate._sum.draftsGenerated) * 100)}%` 
        : '0%',
      icon: <Sparkles className="w-5 h-5 text-emerald-400" />,
      color: 'bg-emerald-500/10 border-emerald-500/20',
      subtitle: `${data?.aggregate?._sum?.draftsApproved || 0} drafts approved`
    },
    {
      title: 'Average Latency',
      value: `${(Number(data?.aggregate?._avg?.averageLatency || 0)).toFixed(0)}ms`,
      icon: <Zap className="w-5 h-5 text-rose-400" />,
      color: 'bg-rose-500/10 border-rose-500/20',
      subtitle: 'Generation speed per draft'
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
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Draft Generation Trends</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Daily breakdown of generated vs approved drafts</p>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedTimeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorGenerated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" strokeOpacity={0.2} />
              <XAxis dataKey="formattedDate" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                itemStyle={{ color: '#f4f4f5' }}
              />
              <Area type="monotone" dataKey="draftsGenerated" name="Generated" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorGenerated)" />
              <Area type="monotone" dataKey="draftsApproved" name="Approved" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#colorApproved)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
