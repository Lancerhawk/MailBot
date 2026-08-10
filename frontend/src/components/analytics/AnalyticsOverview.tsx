import React from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Zap, ShieldCheck, Database } from 'lucide-react';
interface AnalyticsData {
  _sum: {
    emailsReceived: number;
    emailsClassified: number;
    emailsSummarized: number;
    emailsReplied: number;
    draftsGenerated: number;
    draftsApproved: number;
    draftsRejected: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    estimatedCost: number;
    timeSavedSeconds: number;
    knowledgeRetrievalCount: number;
    documentsUploaded: number;
    documentsEmbedded: number;
    processingFailures: number;
    contactsCreated: number;
    organizationsCreated: number;
  };
  _avg: {
    averageConfidence: number;
    averageLatency: number;
    averageReplyGenerationTime: number;
  };
  _max: {
    storageUsedBytes: number | string;
  };
}

interface AnalyticsOverviewProps {
  data: AnalyticsData | null;
  isLoading: boolean;
}

export function AnalyticsOverview({ data, isLoading }: AnalyticsOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 shadow-sm dark:shadow-none" />
        ))}
      </div>
    );
  }

  const kpis = [
    {
      title: 'Emails Synced',
      value: data?._sum?.emailsReceived || 0,
      icon: <Mail className="w-5 h-5 text-blue-400" />,
      color: 'bg-blue-500/10 border-blue-500/20',
      subtitle: 'Historical & new messages'
    },
    {
      title: 'Drafts Automated',
      value: data?._sum?.draftsGenerated || 0,
      icon: <Zap className="w-5 h-5 text-orange-400" />,
      color: 'bg-orange-500/10 border-orange-500/20',
      subtitle: `${data?._sum?.draftsApproved || 0} approved`
    },
    {
      title: 'Knowledge Base Assets',
      value: data?._sum?.documentsUploaded || 0,
      icon: <Database className="w-5 h-5 text-indigo-400" />,
      color: 'bg-indigo-500/10 border-indigo-500/20',
      subtitle: `${data?._sum?.knowledgeRetrievalCount || 0} queries in period`
    },
    {
      title: 'Average AI Confidence',
      value: `${(Number(data?._avg?.averageConfidence || 0) * 100).toFixed(1)}%`,
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      color: 'bg-emerald-500/10 border-emerald-500/20',
      subtitle: 'Average reply confidence'
    }
  ];

  return (
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
  );
}
