import * as React from "react";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-8 h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
          Analytics
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Monitor your email volume and AI performance.
        </p>
      </div>
      
      <EmptyState
        icon={BarChart3}
        title="No data available"
        description="We need more data to generate analytics. Check back later."
      />
    </div>
  );
}
