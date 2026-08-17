import React from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Building2, UserPlus } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';

interface ContactAnalyticsData {
  aggregate: {
    _sum: {
      contactsCreated: number;
      organizationsCreated: number;
      totalContacts?: number;
      totalOrganizations?: number;
    };
  };
  timeseries: {
    date: string;
    contactsCreated: number;
    organizationsCreated: number;
  }[];
}

interface ContactAnalyticsTabProps {
  data?: ContactAnalyticsData;
  isLoading: boolean;
}

export function ContactAnalyticsTab({ data, isLoading }: ContactAnalyticsTabProps) {
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
      title: 'New Contacts',
      value: (data?.aggregate?._sum?.contactsCreated || 0).toLocaleString(),
      icon: <Users className="w-5 h-5 text-sky-400" />,
      color: 'bg-sky-500/10 border-sky-500/20',
      subtitle: 'Automatically identified profiles'
    },
    {
      title: 'Organizations Discovered',
      value: (data?.aggregate?._sum?.organizationsCreated || 0).toLocaleString(),
      icon: <Building2 className="w-5 h-5 text-emerald-400" />,
      color: 'bg-emerald-500/10 border-emerald-500/20',
      subtitle: 'Companies extracted'
    },
    {
      title: 'Network Growth',
      value: `+${((data?.aggregate?._sum?.contactsCreated || 0) + (data?.aggregate?._sum?.organizationsCreated || 0)).toLocaleString()}`,
      icon: <UserPlus className="w-5 h-5 text-violet-400" />,
      color: 'bg-violet-500/10 border-violet-500/20',
      subtitle: 'Total entities added'
    },
    {
      title: 'Total Directory Size',
      value: (data?.aggregate?._sum?.totalContacts || 0).toLocaleString(),
      icon: <Users className="w-5 h-5 text-amber-400" />,
      color: 'bg-amber-500/10 border-amber-500/20',
      subtitle: `${data?.aggregate?._sum?.totalOrganizations || 0} organizations total`
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
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Network Expansion</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Daily creation of new contacts and organizations</p>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedTimeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorContacts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorOrgs" x1="0" y1="0" x2="0" y2="1">
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
              <Area type="monotone" dataKey="contactsCreated" name="Contacts" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorContacts)" />
              <Area type="monotone" dataKey="organizationsCreated" name="Organizations" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#colorOrgs)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
