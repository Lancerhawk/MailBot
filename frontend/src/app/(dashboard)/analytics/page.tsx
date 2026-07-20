'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Calendar, Download, AlertCircle, Loader2, ChevronDown, Info } from 'lucide-react';
import { useSocket } from '@/providers/SocketProvider';
import { Button } from '@/components/ui/button';
import { AnalyticsOverview } from '@/components/analytics/AnalyticsOverview';
import { AnalyticsCharts } from '@/components/analytics/AnalyticsCharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { exportToPDF } from '@/lib/pdf-export';
import axios from 'axios';

const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/analytics`,
  withCredentials: true,
});

const queryClient = new QueryClient();

function AnalyticsContent() {
  const [dateRange, setDateRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  useEffect(() => {
    const handleRefresh = async () => {
      setIsManualRefreshing(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['analytics-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics-charts'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics-activity'] })
      ]);
      setTimeout(() => setIsManualRefreshing(false), 300);
    };

    window.addEventListener('refresh-data', handleRefresh);
    if (socket) {
      socket.on('sync:completed', handleRefresh);
    }

    return () => {
      window.removeEventListener('refresh-data', handleRefresh);
      if (socket) {
        socket.off('sync:completed', handleRefresh);
      }
    };
  }, [queryClient, socket]);

  const filterParams = useMemo(() => {
    const end = new Date();
    const start = new Date();

    if (dateRange === 'custom') {
      if (customStart && customEnd) {
        return { startDate: new Date(customStart).toISOString(), endDate: new Date(customEnd).toISOString() };
      }
      return { startDate: '', endDate: '' };
    }

    if (dateRange === '7d') start.setDate(end.getDate() - 7);
    if (dateRange === '30d') start.setDate(end.getDate() - 30);
    if (dateRange === '90d') start.setDate(end.getDate() - 90);

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
  }, [dateRange, customStart, customEnd]);

  const isCustomMissingDates = dateRange === 'custom' && (!customStart || !customEnd);

  const { data: overview, isLoading: isOverviewLoading, error: overviewError } = useQuery({
    queryKey: ['analytics-overview', dateRange, customStart, customEnd],
    queryFn: async () => {
      const res = await api.get('/overview', { params: filterParams });
      return res.data;
    },
    enabled: !isCustomMissingDates,
    refetchInterval: 30000,
  });

  const { data: charts, isLoading: isChartsLoading } = useQuery({
    queryKey: ['analytics-charts', dateRange, customStart, customEnd],
    queryFn: async () => {
      const res = await api.get('/charts', { params: filterParams });
      return res.data;
    },
    enabled: !isCustomMissingDates,
    refetchInterval: 30000,
  });

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/export', {
        params: filterParams,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics_export_${dateRange}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export CSV data');
    }
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    const filename = `MailBot_Analytics_Report_${dateRange}.pdf`;

    setTimeout(async () => {
      const success = await exportToPDF(filename, filterParams);
      if (!success) {
        alert('Failed to export PDF');
      }
      setIsExportingPDF(false);
    }, 100);
  };

  return (
    <div className="flex flex-col gap-6 h-full relative pb-10">

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col space-y-1"
          >
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              Analytics & Insights
              <div className="relative group flex items-center">
                <Info className="h-5 w-5 text-orange-500 hover:text-orange-600 dark:text-red-500 dark:hover:text-red-400 cursor-pointer transition-colors" />
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none text-left font-normal leading-relaxed">
                  <p>
                    <span className="font-semibold text-orange-600 dark:text-red-500">Note:</span> All analytics data is recorded and grouped according to standard UTC time.
                  </p>
                </div>
              </div>
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">Real-time metrics and AI usage trends.</p>
          </motion.div>

          <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4 w-full md:w-auto mt-4 md:mt-0">

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto">
              <div className="relative w-full sm:w-auto">
                <select
                  className="w-full sm:w-auto appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm cursor-pointer"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="custom">Custom Range...</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 dark:text-zinc-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {dateRange === 'custom' && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center space-x-2 bg-zinc-50 dark:bg-zinc-900/50 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 w-full sm:w-auto overflow-x-auto">
                  <input type="date" max={new Date().toISOString().split('T')[0]} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50 h-8 w-full sm:w-auto dark:[&::-webkit-calendar-picker-indicator]:invert" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                  <span className="text-zinc-500 text-xs font-medium px-1">to</span>
                  <input type="date" max={new Date().toISOString().split('T')[0]} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50 h-8 w-full sm:w-auto dark:[&::-webkit-calendar-picker-indicator]:invert" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                </motion.div>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 w-full xl:w-auto" disabled={isExportingPDF}>
                  {isExportingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800/80">
                <DropdownMenuItem onClick={handleExportPDF} className="text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800 cursor-pointer">
                  Export as PDF (Report)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} className="text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800 cursor-pointer">
                  Export as CSV (Data)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {overviewError && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-start space-x-3 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-300">Failed to load analytics</h3>
              <p className="text-sm mt-1">Please try refreshing the page or check if the analytics service is running.</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {isCustomMissingDates ? (
            <div className="flex flex-col items-center justify-center py-32 text-zinc-500 border border-zinc-200 dark:border-zinc-800/80 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20 border-dashed">
              <Calendar className="w-12 h-12 mb-4 opacity-50 text-orange-500" />
              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-300">Select Date Range</h3>
              <p className="text-sm mt-1">Please select both a start and end date to view custom analytics.</p>
            </div>
          ) : (
            <>
              <AnalyticsOverview data={overview} isLoading={isOverviewLoading || isManualRefreshing} />
              <div id="pdf-chart-container">
                <AnalyticsCharts data={charts} isLoading={isChartsLoading || isManualRefreshing} filterParams={filterParams} />
              </div>
            </>
          )}
        </div>

    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <AnalyticsContent />
    </QueryClientProvider>
  );
}
