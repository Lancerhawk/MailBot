"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Star,
  Pin,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Globe,
  Calendar,
  MessageSquare,
  Edit3,
  Archive,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Copy,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactEditModal } from "./ContactEditModal";
import { ContactEmails } from "./ContactEmails";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Contact } from "./Contacts";

interface ContactIntelligence {
  totalEmails: number;
  incomingCount: number;
  outgoingCount: number;
  conversationCount: number;
  firstContacted: string | null;
  lastContacted: string | null;
  interactionScore: number;
  draftCount: number;
  mostActiveWeekday: string | null;
  mostActiveMonth: string | null;
  weekdayDistribution: Record<string, number>;
  monthDistribution: Record<string, number>;
}

interface ContactWithIntelligence extends Contact {
  intelligence: ContactIntelligence | null;
  mergedFrom?: Contact[];
}

interface TimelineEntry {
  type: string;
  date: string;
  data: Record<string, unknown>;
}

const AVATAR_COLORS = [
  "bg-rose-500", "bg-sky-500", "bg-violet-500", "bg-amber-500",
  "bg-emerald-500", "bg-fuchsia-500", "bg-cyan-500", "bg-orange-500",
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

function getScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-500";
  if (score >= 40) return "text-amber-500";
  return "text-zinc-400";
}

function getScoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-zinc-400";
}

export function ContactProfile() {
  const params = useParams();
  const router = useRouter();
  const contactId = params?.id as string;

  const [contact, setContact] = useState<ContactWithIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "emails" | "merged">("overview");
  const [editOpen, setEditOpen] = useState(false);

  const fetchContact = useCallback(async () => {
    try {
      setTimeout(() => setLoading(true), 0);
      const res = await api.get(`/contacts/${contactId}`);
      setContact(res.data.data);
    } catch {
      toast.error("Failed to load contact");
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  const fetchTimeline = useCallback(async () => {
    try {
      setTimeout(() => setTimelineLoading(true), 0);
      const res = await api.get(`/contacts/${contactId}/timeline`);
      setTimeline(res.data.data);
    } catch {
    } finally {
      setTimelineLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchContact();
      fetchTimeline();
    });
  }, [fetchContact, fetchTimeline]);

  const handleToggleFavorite = async () => {
    if (!contact) return;
    const newVal = !contact.favorite;
    setContact(prev => prev ? { ...prev, favorite: newVal } : prev);
    try {
      await api.patch(`/contacts/${contactId}`, { favorite: newVal });
    } catch {
      setContact(prev => prev ? { ...prev, favorite: !newVal } : prev);
    }
  };

  const handleTogglePin = async () => {
    if (!contact) return;
    const newVal = !contact.pinned;
    setContact(prev => prev ? { ...prev, pinned: newVal } : prev);
    try {
      await api.patch(`/contacts/${contactId}`, { pinned: newVal });
    } catch {
      setContact(prev => prev ? { ...prev, pinned: !newVal } : prev);
    }
  };

  const handleArchive = async () => {
    try {
      await api.post(`/contacts/${contactId}/archive`);
      toast.success("Contact archived");
      router.push("/contacts");
    } catch {
      toast.error("Failed to archive");
    }
  };

  const copyEmail = () => {
    if (contact) {
      navigator.clipboard.writeText(contact.emailAddress);
      toast.success("Email copied");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-zinc-500">Contact not found</p>
        <Button variant="outline" onClick={() => router.push("/contacts")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Contacts
        </Button>
      </div>
    );
  }

  const intel = contact.intelligence;
  const initials = getInitials(contact.displayName, contact.emailAddress);
  const avatarColor = getAvatarColor(contact.emailAddress);

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={() => router.push("/contacts")}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors w-fit cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Contacts
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {contact.avatarUrl ? (
            <Image
              src={contact.avatarUrl}
              alt=""
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className={cn("flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white", avatarColor)}>
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {contact.displayName || contact.emailAddress}
              </h1>
              {contact.relationship && (
                <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                  {contact.relationship}
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {contact.emailAddress}
              </span>
              {contact.jobTitle && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" /> {contact.jobTitle}
                </span>
              )}
              {(contact.company || contact.organization?.name) && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {contact.company || contact.organization?.name}
                </span>
              )}
              {contact.phoneNumber && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {contact.phoneNumber}
                </span>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              {contact.linkedinUrl && (
                <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                </a>
              )}
              {contact.twitterUrl && (
                <a href={contact.twitterUrl} target="_blank" rel="noreferrer" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-sky-500 dark:hover:bg-zinc-800">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" /></svg>
                </a>
              )}
              {contact.website && (
                <a href={contact.website} target="_blank" rel="noreferrer" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-emerald-500 dark:hover:bg-zinc-800">
                  <Globe className="h-4 w-4" />
                </a>
              )}
            </div>

            {contact.labels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {contact.labels.map(l => (
                  <span key={l} className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{l}</span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
            <Button variant="outline" size="icon" onClick={handleToggleFavorite}>
              <Star className={cn("h-4 w-4", contact.favorite && "fill-amber-400 text-amber-400")} />
            </Button>
            <Button variant="outline" size="icon" onClick={handleTogglePin}>
              <Pin className={cn("h-4 w-4", contact.pinned && "fill-blue-400 text-blue-400")} />
            </Button>
            <Button variant="outline" size="icon" onClick={copyEmail}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={handleArchive} className="text-red-500 hover:text-red-600">
              <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
            </Button>
          </div>
        </div>
      </motion.div>

      {intel && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
          {[
            { label: "Interaction Score", value: `${intel.interactionScore}%`, icon: TrendingUp, color: getScoreColor(intel.interactionScore) },
            { label: "Total Emails", value: intel.totalEmails, icon: Mail },
            { label: "Incoming", value: intel.incomingCount, icon: ArrowDownLeft, color: "text-blue-500" },
            { label: "Outgoing", value: intel.outgoingCount, icon: ArrowUpRight, color: "text-emerald-500" },
            { label: "Conversations", value: intel.conversationCount, icon: MessageSquare },
            { label: "AI Drafts", value: intel.draftCount, icon: Sparkles, color: "text-violet-500" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2">
                <s.icon className={cn("h-4 w-4 text-zinc-400", s.color)} />
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{s.label}</p>
              </div>
              <p className={cn("mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums", s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {intel && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Relationship Strength</p>
            <p className={cn("text-sm font-bold", getScoreColor(intel.interactionScore))}>{intel.interactionScore}%</p>
          </div>
          <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", getScoreBg(intel.interactionScore))}
              initial={{ width: 0 }}
              animate={{ width: `${intel.interactionScore}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-zinc-400">
            {intel.mostActiveWeekday && <span>Most active: <strong className="text-zinc-600 dark:text-zinc-300">{intel.mostActiveWeekday}</strong></span>}
            {intel.mostActiveMonth && <span>Peak month: <strong className="text-zinc-600 dark:text-zinc-300">{intel.mostActiveMonth}</strong></span>}
            {intel.firstContacted && <span>Since: <strong className="text-zinc-600 dark:text-zinc-300">{new Date(intel.firstContacted).toLocaleDateString()}</strong></span>}
          </div>
        </div>
      )}

      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-6">
          {(["overview", "timeline", "emails", "merged"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "pb-3 text-sm font-medium transition-colors capitalize border-b-2 cursor-pointer",
                activeTab === tab
                  ? "border-orange-500 text-orange-600 dark:text-orange-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className={activeTab === "overview" ? "block" : "hidden"}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Personal Notes</h3>
            {contact.customNotes ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{contact.customNotes}</p>
            ) : (
              <p className="text-sm text-zinc-400 italic">No notes yet. Click Edit to add notes.</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" /> AI Summary
            </h3>
            {contact.aiSummary ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{contact.aiSummary}</p>
            ) : (
              <p className="text-sm text-zinc-400 italic">No AI summary generated yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Preferred AI Tone</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {contact.preferredTone || "Default tone"}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Details</h3>
            <div className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                <span>Added {new Date(contact.createdAt).toLocaleDateString()}</span>
              </div>
              {contact.organization && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{contact.organization.name} ({contact.organization.domain})</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={activeTab === "timeline" ? "block" : "hidden"}>
        <div className="space-y-3">
          {timelineLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 items-start">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
            ))
          ) : timeline.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 py-8">No timeline events yet.</p>
          ) : (
            timeline.map((entry, idx) => (
              <div key={idx} className="flex gap-4 items-start rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  entry.type === "email_received" ? "bg-blue-100 dark:bg-blue-500/10" :
                    entry.type === "email_sent" ? "bg-emerald-100 dark:bg-emerald-500/10" :
                      "bg-violet-100 dark:bg-violet-500/10"
                )}>
                  {entry.type === "email_received" ? <ArrowDownLeft className="h-4 w-4 text-blue-500" /> :
                    entry.type === "email_sent" ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> :
                      <Sparkles className="h-4 w-4 text-violet-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {entry.type === "email_received" ? "Received Email" :
                      entry.type === "email_sent" ? "Sent Email" :
                        "Draft Generated"}
                  </p>
                  {(entry.data.subject as string) && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{entry.data.subject as string}</p>
                  )}
                  <p className="text-xs text-zinc-400 mt-0.5">{new Date(entry.date).toLocaleString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={activeTab === "emails" ? "block" : "hidden"}>
        <ContactEmails contactEmail={contact.emailAddress} />
      </div>

      <div className={activeTab === "merged" ? "block" : "hidden"}>
        <div className="space-y-4">
          {!contact.mergedFrom || contact.mergedFrom.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 py-8">No contacts have been merged into this profile.</p>
          ) : (
            contact.mergedFrom.map(mc => (
              <div key={mc.id} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 flex items-center gap-4">
                <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-medium text-zinc-600 dark:text-zinc-300">
                  {mc.displayName?.charAt(0).toUpperCase() || mc.emailAddress.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{mc.displayName || "Unknown Name"}</h4>
                  <p className="text-xs text-zinc-500 truncate">{mc.emailAddress}</p>
                </div>
                <div className="shrink-0 text-xs text-zinc-400">
                  Merged {new Date(mc.updatedAt || mc.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editOpen && (
        <ContactEditModal
          contact={contact}
          onClose={() => setEditOpen(false)}
          onSaved={() => { fetchContact(); setEditOpen(false); }}
        />
      )}
    </div>
  );
}
