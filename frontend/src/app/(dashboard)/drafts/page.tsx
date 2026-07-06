import * as React from "react";
import { PenSquare } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";

export default function DraftsPage() {
  return (
    <div className="flex flex-col gap-8 h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
          AI Drafts
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Review and approve AI-generated email responses.
        </p>
      </div>
      
      <EmptyState
        icon={PenSquare}
        title="No pending drafts"
        description="You have reviewed all AI-generated drafts. Great job!"
      />
    </div>
  );
}
