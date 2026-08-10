import React from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, ShieldAlert, Clock, Inbox } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';

interface EmailAnalyticsData {
  aggregate: {
    _sum: {
      emailsReceived: number;
      emailsClassified: number;
      emailsSummarized: number;
      emailsReplied: number;
      timeSavedSeconds: number;
    };
    _avg: {
      averageReplyGenerationTime: number;
    };
  };
  timeseries: {
    date: string;
    emailsReceived: number;
    emailsReplied: number;
  }[];
}

interface EmailAnalyticsTabProps {
  data?: EmailAnalyticsData;
  isLoading: boolean;
}

export function EmailAnalyticsTab({ data, isLoading }: EmailAnalyticsTabProps) {
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
      title: 'Emails Synced',
      value: (data?.aggregate?._sum?.emailsReceived || 0).toLocaleString(),
      icon: <Inbox className="w-5 h-5 text-sky-400" />,
      color: 'bg-sky-500/10 border-sky-500/20',
      subtitle: 'Historical & new messages'
    },
    {
      title: 'Time Saved',
      value: `${Math.round((data?.aggregate?._sum?.timeSavedSeconds || 0) / 3600)}h`,
      icon: <Clock className="w-5 h-5 text-emerald-400" />,
      color: 'bg-emerald-500/10 border-emerald-500/20',
      subtitle: 'From AI summarization & replies'
    },
    {
      title: 'Automated Replies',
      value: (data?.aggregate?._sum?.emailsReplied || 0).toLocaleString(),
      icon: <Mail className="w-5 h-5 text-violet-400" />,
      color: 'bg-violet-500/10 border-violet-500/20',
      subtitle: 'Sent autonomously'
    },
    {
      title: 'Summarized',
      value: (data?.aggregate?._sum?.emailsSummarized || 0).toLocaleString(),
      icon: <ShieldAlert className="w-5 h-5 text-fuchsia-400" />,
      color: 'bg-fuchsia-500/10 border-fuchsia-500/20',
      subtitle: 'Emails condensed'
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
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Email Traffic</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Incoming messages vs outbound AI replies</p>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedTimeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" strokeOpacity={0.2} />
              <XAxis dataKey="formattedDate" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                itemStyle={{ color: '#f4f4f5' }}
                cursor={{ fill: '#3f3f46', opacity: 0.2 }}
              />
              <Bar dataKey="emailsReceived" name="Received" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="emailsReplied" name="Replied" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
