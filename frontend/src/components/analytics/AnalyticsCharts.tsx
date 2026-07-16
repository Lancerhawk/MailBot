import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, LineChart, Line
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { ActivityFeed } from './ActivityFeed';

interface AnalyticsDay {
  date: string;
  emailsReceived: number;
  emailsReplied: number;
  draftsGenerated: number;
  draftsApproved: number;
  averageConfidence: number;
  storageUsedBytes: string | number;
  estimatedCost: string | number;
  [key: string]: unknown;
}

interface AnalyticsChartsProps {
  data?: AnalyticsDay[];
  isLoading: boolean;
  filterParams?: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-700 p-3 rounded-lg shadow-xl backdrop-blur-sm">
        <p className="text-zinc-900 dark:text-zinc-300 font-semibold mb-2">{label}</p>
        {payload.map((p: Record<string, unknown>, i: number) => (
          <div key={i} className="flex items-center space-x-2 text-sm">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color as string }} />
            <span className="text-zinc-600 dark:text-zinc-400">{p.name as string}:</span>
            <span className="font-medium text-zinc-900 dark:text-white">{p.value as React.ReactNode}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderLegend = (props: any) => {
  const { payload } = props;

  if (!payload || payload.length === 0) {
    return null;
  }

  if (payload.length === 1) {
    return (
      <div className="flex w-full justify-center pt-5">
        <div className="flex items-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: payload[0].color as string }} />
          {payload[0].value as React.ReactNode}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-between pt-5 pl-8 pr-2">
      {payload.map((entry: Record<string, unknown>, index: number) => (
        <div key={`item-${index}`} className="flex items-center text-sm font-medium text-zinc-300">
          <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: entry.color as string }} />
          {entry.value as React.ReactNode}
        </div>
      ))}
    </div>
  );
};

export function AnalyticsCharts({ data, isLoading, filterParams }: AnalyticsChartsProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[400px] rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" />
        <Skeleton className="h-[400px] rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 flex items-center justify-center text-zinc-500 flex-col space-y-3">
        <div className="text-lg font-medium">No analytics data found for this period</div>
        <p className="text-sm">Try running the backfill process or selecting a wider date range.</p>
      </div>
    );
  }

  // Format data for Recharts
  const chartData = data.map(day => ({
    ...day,
    formattedDate: format(parseISO(day.date), 'MMM dd'),
    cost: Number(day.estimatedCost) || 0,
    storageMB: (Number(day.storageUsedBytes) || 0) / (1024 * 1024), // MB
  }));

  const totalReceived = data.reduce((acc, curr) => acc + (curr.emailsReceived || 0), 0);
  const totalReplied = data.reduce((acc, curr) => acc + (curr.emailsReplied || 0), 0);
  const totalDraftsGen = data.reduce((acc, curr) => acc + (curr.draftsGenerated || 0), 0);
  const totalDraftsApp = data.reduce((acc, curr) => acc + (curr.draftsApproved || 0), 0);
  const avgConf = data.length ? data.reduce((acc, curr) => acc + (curr.averageConfidence || 0), 0) / data.length : 0;
  const currentStorage = data.length ? data[data.length - 1].storageUsedBytes : 0;
  const totalStorageMB = (Number(currentStorage) / (1024 * 1024)).toFixed(1);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full">

      <div className="order-2 xl:order-1 xl:col-span-2 flex flex-col gap-6 bg-white dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-800/80 p-5 lg:p-8 rounded-xl w-full h-full shadow-sm dark:shadow-none">

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6 w-full"
        >
          <div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Email Volume</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full h-full">
            <div className="lg:col-span-7 w-full h-[250px] sm:h-[300px] lg:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorReplied" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="formattedDate" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4' }} wrapperStyle={{ outline: 'none' }} />
                  <Legend content={renderLegend} />
                  <Area type="monotone" dataKey="emailsReceived" name="Received" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorReceived)" activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={300} />
                  <Area type="monotone" dataKey="emailsReplied" name="Sent Replies" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorReplied)" activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={300} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="lg:col-span-5 w-full flex flex-col justify-center space-y-6 lg:pl-6 lg:border-l border-zinc-300 dark:border-zinc-800/50">
              <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                This chart tracks the overall flow of emails through your system. It compares the raw volume of incoming mail against the total number of outgoing replies processed by MailBot.
              </p>
              <div className="flex flex-col space-y-3 pt-2 w-full">
                <div className="w-full flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/80 p-4 rounded-xl border border-zinc-300 dark:border-zinc-800/80 shadow-md dark:shadow-none">
                  <span className="text-zinc-600 dark:text-zinc-400 text-sm flex items-center font-medium"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-3" /> Total Received</span>
                  <span className="font-bold text-zinc-900 dark:text-white text-xl">{totalReceived.toLocaleString()}</span>
                </div>
                <div className="w-full flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/80 p-4 rounded-xl border border-zinc-300 dark:border-zinc-800/80 shadow-md dark:shadow-none">
                  <span className="text-zinc-600 dark:text-zinc-400 text-sm flex items-center font-medium"><div className="w-2.5 h-2.5 rounded-full bg-purple-500 mr-3" /> Total Replies</span>
                  <span className="font-bold text-zinc-900 dark:text-white text-xl">{totalReplied.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="w-full h-px bg-zinc-300 dark:bg-zinc-800/50 my-2" />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-6 w-full"
        >
          <div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Draft Automation</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full h-full">
            <div className="lg:col-span-7 w-full h-[250px] sm:h-[300px] lg:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="formattedDate" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a', opacity: 0.4 }} wrapperStyle={{ outline: 'none' }} />
                  <Legend content={renderLegend} />
                  <Bar dataKey="draftsGenerated" name="Drafts Generated" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={40} animationDuration={300} />
                  <Bar dataKey="draftsApproved" name="Drafts Approved" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} animationDuration={300} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="lg:col-span-5 w-full flex flex-col justify-center space-y-6 lg:pl-6 lg:border-l border-zinc-300 dark:border-zinc-800/50">
              <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                Analyzes MailBot&apos;s drafting efficiency. It visualizes the total number of AI-generated drafts compared to how many were actually approved and sent.
              </p>
              <div className="flex flex-col space-y-3 pt-2 w-full">
                <div className="w-full flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/80 p-4 rounded-xl border border-zinc-300 dark:border-zinc-800/80 shadow-md dark:shadow-none">
                  <span className="text-zinc-600 dark:text-zinc-400 text-sm flex items-center font-medium"><div className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-3" /> Total Generated</span>
                  <span className="font-bold text-zinc-900 dark:text-white text-xl">{totalDraftsGen.toLocaleString()}</span>
                </div>
                <div className="w-full flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/80 p-4 rounded-xl border border-zinc-300 dark:border-zinc-800/80 shadow-md dark:shadow-none">
                  <span className="text-zinc-600 dark:text-zinc-400 text-sm flex items-center font-medium"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-3" /> Total Approved</span>
                  <span className="font-bold text-zinc-900 dark:text-white text-xl">{totalDraftsApp.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Column: Activity Feed (col-span-1) */}
      <div className="order-1 xl:order-2 xl:col-span-1 h-[500px] xl:h-auto xl:relative">
        <div className="w-full h-full xl:absolute xl:inset-0">
          <ActivityFeed filterParams={filterParams} />
        </div>
      </div>

      {/* Bottom Section: Full Width Charts (col-span-3) */}
      {/* Chart 3: AI Confidence Trend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="order-3 xl:col-span-3 bg-white dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800/80 p-5 lg:p-6 rounded-xl flex flex-col gap-6 w-full shadow-sm dark:shadow-none"
      >
        <div>
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">AI Confidence Trend</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
          <div className="lg:col-span-7 w-full h-[250px] sm:h-[300px] lg:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="formattedDate" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(tick) => `${(tick * 100).toFixed(0)}%`} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4' }} wrapperStyle={{ outline: 'none' }} />
                <Legend content={renderLegend} />
                <Line type="monotone" dataKey="averageConfidence" name="Confidence Score" stroke="#ec4899" strokeWidth={3} dot={{ r: 4, fill: '#ec4899', strokeWidth: 0 }} activeDot={{ r: 7, strokeWidth: 0 }} animationDuration={300} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-5 w-full flex flex-col justify-center space-y-6 lg:pl-6 lg:border-l border-zinc-300 dark:border-zinc-800/50">
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
              Tracks the internal confidence probability of MailBot&apos;s generation engine over time. A rising trend indicates the AI is becoming more certain of its context.
            </p>
            <div className="flex flex-col space-y-3 pt-2 w-full">
              <div className="w-full flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/80 p-4 rounded-xl border border-zinc-300 dark:border-zinc-800/80 shadow-md dark:shadow-none">
                <span className="text-zinc-600 dark:text-zinc-400 text-sm flex items-center font-medium"><div className="w-2.5 h-2.5 rounded-full bg-pink-500 mr-3" /> Average Score</span>
                <span className="font-bold text-zinc-900 dark:text-white text-xl">{(avgConf * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Chart 4: Knowledge Base Growth (col-span-3) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="order-4 xl:col-span-3 bg-white dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800/80 p-5 lg:p-6 rounded-xl flex flex-col gap-6 w-full shadow-sm dark:shadow-none"
      >
        <div>
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Knowledge Base Scale</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
          <div className="lg:col-span-7 w-full h-[250px] sm:h-[300px] lg:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorStorage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="formattedDate" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(tick) => `${tick} MB`} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4' }} wrapperStyle={{ outline: 'none' }} />
                <Legend content={renderLegend} />
                <Area type="monotone" dataKey="storageMB" name="Storage Used (MB)" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#colorStorage)" activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={300} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-5 w-full flex flex-col justify-center space-y-6 lg:pl-6 lg:border-l border-zinc-800/50">
            <p className="text-zinc-400 text-sm leading-relaxed">
              Monitors the growth of vector embeddings and document context used by MailBot for semantic retrieval and personalized replies.
            </p>
            <div className="flex flex-col space-y-3 pt-2 w-full">
              <div className="w-full flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/80 p-4 rounded-xl border border-zinc-300 dark:border-zinc-800/80 shadow-md dark:shadow-none">
                <span className="text-zinc-600 dark:text-zinc-400 text-sm flex items-center font-medium"><div className="w-2.5 h-2.5 rounded-full bg-teal-500 mr-3" /> Total Size</span>
                <span className="font-bold text-zinc-900 dark:text-white text-xl">{totalStorageMB} MB</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
