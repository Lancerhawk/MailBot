"use client";

import * as React from "react";
import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Overview of your email management and AI statistics.
        </p>
      </div>
      
      {user ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Account Connected"
          description={`Your Google account (${user.email}) is successfully connected. MailBot features will be available here soon.`}
          action={<Button disabled>Syncing Data...</Button>}
        />
      ) : (
        <EmptyState
          icon={LayoutDashboard}
          title="Welcome to MailBot"
          description="Your dashboard is currently empty. Connect your email account to see your statistics."
          action={<Button>Connect Account</Button>}
        />
      )}
    </div>
  );
}
