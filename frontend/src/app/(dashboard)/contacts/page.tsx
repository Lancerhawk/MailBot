import * as React from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

export default function ContactsPage() {
  return (
    <div className="flex flex-col gap-8 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Contacts
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Manage your network and relationships.
          </p>
        </div>
      </div>
      
      <EmptyState
        icon={Users}
        title="Coming Soon"
        description="The CRM and Contacts feature is currently under development. Stay tuned!"
      />
    </div>
  );
}
