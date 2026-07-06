import * as React from "react";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

export default function InboxPage() {
  return (
    <div className="flex flex-col gap-8 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Inbox
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Manage your emails and AI-generated drafts.
          </p>
        </div>
        <Button>Sync Now</Button>
      </div>
      
      <EmptyState
        icon={Inbox}
        title="No emails found"
        description="Your inbox is empty. New emails will appear here when they arrive."
      />
    </div>
  );
}
