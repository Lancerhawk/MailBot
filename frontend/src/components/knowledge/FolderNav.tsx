"use client";

import { cn } from "@/lib/utils";
import {
  Folder,
  FolderOpen,
  User,
  Briefcase,
  GraduationCap,
  Building2,
  DollarSign,
  Scale,
  MoreHorizontal,
} from "lucide-react";

const FOLDERS = [
  { name: "All", icon: Folder },
  { name: "Personal", icon: User },
  { name: "Career", icon: Briefcase },
  { name: "Projects", icon: FolderOpen },
  { name: "Business", icon: Building2 },
  { name: "Finance", icon: DollarSign },
  { name: "Legal", icon: Scale },
  { name: "Education", icon: GraduationCap },
  { name: "Other", icon: MoreHorizontal },
];

interface FolderNavProps {
  activeFolder: string;
  onFolderChange: (folder: string) => void;
  folderCounts: Record<string, number>;
}

export function FolderNav({ activeFolder, onFolderChange, folderCounts }: FolderNavProps) {
  return (
    <nav className="flex flex-col gap-0.5">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Folders
      </p>
      {FOLDERS.map((folder) => {
        const isActive = activeFolder === folder.name;
        const count = folderCounts[folder.name] || 0;
        const Icon = folder.icon;

        return (
          <button
            key={folder.name}
            onClick={() => onFolderChange(folder.name)}
            className={cn(
              "cursor-pointer group flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200"
            )}
          >
            <span className="flex items-center gap-2.5">
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
                )}
              />
              <span>{folder.name}</span>
            </span>
            {count > 0 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums transition-colors",
                  isActive
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
