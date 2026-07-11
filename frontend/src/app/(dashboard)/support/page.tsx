import * as React from "react";
import { HelpCircle } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

export default function SupportPage() {
  return (
    <div className="flex flex-col gap-8 h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
          Support
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Get help with your MailBot account.
        </p>
      </div>
      
      <EmptyState
        icon={HelpCircle}
        title="Coming Soon"
        description="The integrated support center is currently under development. Stay tuned!"
      />
    </div>
  );
}
