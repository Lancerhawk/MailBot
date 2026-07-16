"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Star,
  Pin,
  MoreVertical,
  Mail,
  Building2,
  Briefcase,
  Phone,
  Archive,
  Merge,
  Edit3,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Contact } from "./Contacts";

const AVATAR_COLORS = [
  "bg-rose-500", "bg-sky-500", "bg-violet-500", "bg-amber-500",
  "bg-emerald-500", "bg-fuchsia-500", "bg-cyan-500", "bg-orange-500",
  "bg-lime-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500",
];

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  CLIENT: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  CUSTOMER: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  SUPPLIER: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  PARTNER: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
  INTERNAL: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
  OTHER: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

interface ContactCardProps {
  contact: Contact;
  onFavorite: () => void;
  onPin: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onMerge: () => void;
}

export function ContactCard({ contact, onFavorite, onPin, onEdit, onArchive, onMerge }: ContactCardProps) {
  const initials = getInitials(contact.displayName, contact.emailAddress);
  const avatarColor = getAvatarColor(contact.emailAddress);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="group relative flex h-full flex-col rounded-xl border border-zinc-300 bg-white p-5 shadow-md transition-all hover:shadow-lg hover:border-zinc-400 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-xl dark:hover:border-zinc-700"
    >
      {contact.pinned && (
        <div className="absolute -top-1.5 -right-1.5 rounded-full bg-blue-500 p-1">
          <Pin className="h-2.5 w-2.5 text-white" />
        </div>
      )}

      <div className="flex items-start gap-3">
        <Link href={`/contacts/${contact.id}`}>
          {contact.avatarUrl ? (
            <Image
              src={contact.avatarUrl}
              alt=""
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white", avatarColor)}>
              {initials}
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/contacts/${contact.id}`}
              className="truncate text-sm font-semibold text-zinc-900 hover:text-orange-600 dark:text-zinc-100 dark:hover:text-orange-400 transition-colors"
            >
              {contact.displayName || contact.emailAddress}
            </Link>
            {contact.favorite && (
              <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
            )}
          </div>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{contact.emailAddress}</p>

          {(contact.company || contact.jobTitle || contact.organization) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-400 dark:text-zinc-500">
              {contact.jobTitle && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {contact.jobTitle}
                </span>
              )}
              {(contact.company || contact.organization?.name) && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {contact.company || contact.organization?.name}
                </span>
              )}
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="cursor-pointer rounded-md p-1 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Edit3 className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onFavorite}>
              <Star className={cn("mr-2 h-4 w-4", contact.favorite && "fill-amber-400 text-amber-400")} />
              {contact.favorite ? "Unfavorite" : "Favorite"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPin}>
              <Pin className={cn("mr-2 h-4 w-4", contact.pinned && "fill-blue-400 text-blue-400")} />
              {contact.pinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMerge}>
              <Merge className="mr-2 h-4 w-4" /> Merge
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive} className="text-red-600 dark:text-red-400">
              <Archive className="mr-2 h-4 w-4" /> Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {contact.relationship && (
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", RELATIONSHIP_COLORS[contact.relationship] || RELATIONSHIP_COLORS.OTHER)}>
            {contact.relationship}
          </span>
        )}
        {contact.labels.slice(0, 2).map((label) => (
          <span key={label} className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {label}
          </span>
        ))}
        {contact.labels.length > 2 && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">+{contact.labels.length - 2}</span>
        )}
      </div>

      <div className="mt-auto pt-3 flex items-center gap-x-3 text-xs text-zinc-400 dark:text-zinc-500">
        <span className="flex items-center gap-1">
          <Mail className="h-3 w-3" />
          {contact.interactionCount} emails
        </span>
        <span className="text-zinc-300 dark:text-zinc-700">•</span>
        <span>{formatTimeAgo(contact.lastInteraction)}</span>
        {contact.phoneNumber && (
          <>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {contact.phoneNumber}
            </span>
          </>
        )}
      </div>
    </motion.div>
  );
}
