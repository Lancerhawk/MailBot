import * as React from "react";
import { Settings } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8 h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
          Settings
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Manage your account settings and AI preferences.
        </p>
      </div>
      
      <EmptyState
        icon={Settings}
        title="Settings placeholder"
        description="Configuration options will be available in Phase 4."
      />
    </div>
  );
}
