import * as React from "react";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

export default function KnowledgeBasePage() {
  return (
    <div className="flex flex-col gap-8 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Knowledge Base
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Manage the documents and context the AI uses to draft emails.
          </p>
        </div>
      </div>
      
      <EmptyState
        icon={BookOpen}
        title="Coming Soon"
        description="The AI Knowledge Base and custom document uploading is currently under development. Stay tuned!"
      />
    </div>
  );
}
