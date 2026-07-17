"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users,
  Search,
  Star,
  Pin,
  Filter,
  Building2,
  TrendingUp,
  Heart,
  UserCheck,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ContactCard } from "./ContactCard";
import { ContactEditModal } from "./ContactEditModal";
import { MergeContactsModal } from "./MergeContactsModal";
import { useSocket } from "@/providers/SocketProvider";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "@/lib/toast";

export interface Contact {
  id: string;
  emailAddress: string;
  displayName: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  phoneNumber: string | null;
  preferredTone: string | null;
  relationship: string | null;
  interactionCount: number;
  lastInteraction: string | null;
  customNotes: string | null;
  favorite: boolean;
  pinned: boolean;
  company: string | null;
  linkedinUrl: string | null;
  website: string | null;
  twitterUrl: string | null;
  labels: string[];
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
  organization: {
    id: string;
    name: string;
    domain: string;
  } | null;
}

interface Stats {
  total: number;
  favorites: number;
  pinned: number;
  recentActive: number;
  withOrg: number;
}

const FILTER_OPTIONS = [
  { value: "", label: "All Contacts", icon: Users },
  { value: "favorites", label: "Favorites", icon: Star },
  { value: "pinned", label: "Pinned", icon: Pin },
  { value: "recent", label: "Recent (7 days)", icon: TrendingUp },
  { value: "highInteraction", label: "High Interaction", icon: Heart },
  { value: "hasNotes", label: "Has Notes", icon: UserCheck },
  { value: "hasCompany", label: "Has Company", icon: Building2 },
  { value: "inactive", label: "Inactive (30+ days)", icon: X },
];

const SORT_OPTIONS = [
  { value: "recentlyContacted", label: "Recently Contacted" },
  { value: "mostContacted", label: "Most Contacted" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "recentlyAdded", label: "Recently Added" },
  { value: "oldest", label: "Oldest" },
];

const RELATIONSHIP_OPTIONS = [
  { value: "", label: "All Relationships" },
  { value: "CLIENT", label: "Client" },
  { value: "CUSTOMER", label: "Customer" },
  { value: "SUPPLIER", label: "Supplier" },
  { value: "PARTNER", label: "Partner" },
  { value: "INTERNAL", label: "Internal" },
  { value: "OTHER", label: "Other" },
];

export interface Organization {
  id: string;
  name: string;
  domain: string;
  _count: {
    contacts: number;
  };
}

export function Contacts() {
  const [activeView, setActiveView] = useState<"contacts" | "organizations">("contacts");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgPage, setOrgPage] = useState(1);
  const [orgTotalPages, setOrgTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("recentlyContacted");
  const [relationship, setRelationship] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [mergeContact, setMergeContact] = useState<Contact | null>(null);

  const { socket } = useSocket();
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  const fetchContacts = useCallback(async () => {
    try {
      setTimeout(() => setLoading(true), 0);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filter) params.set("filter", filter);
      if (sort) params.set("sort", sort);
      if (relationship) params.set("relationship", relationship);

      const res = await api.get(`/contacts?${params.toString()}`);
      setContacts(res.data.data);
      if (res.data.pagination) {
        setTotalPages(res.data.pagination.totalPages);
        setTotal(res.data.pagination.total);
      }
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filter, sort, relationship]);

  const fetchStats = useCallback(() => {
    api.get("/contacts/stats")
      .then(res => {
        setStats(res.data.data);
      })
      .catch(() => {});
  }, []);

  const fetchOrganizations = useCallback(async () => {
    try {
      setTimeout(() => setOrgLoading(true), 0);
      const res = await api.get(`/contacts/organizations?page=${orgPage}&limit=30${debouncedSearch ? `&search=${debouncedSearch}` : ''}`);
      setOrganizations(res.data.data);
      if (res.data.pagination) {
        setOrgTotalPages(res.data.pagination.totalPages);
      }
    } catch {
      toast.error("Failed to load organizations");
    } finally {
      setOrgLoading(false);
    }
  }, [orgPage, debouncedSearch]);

  useEffect(() => {
    if (activeView === "contacts") {
      void Promise.resolve().then(() => fetchContacts());
    } else {
      void Promise.resolve().then(() => fetchOrganizations());
    }
  }, [activeView, fetchContacts, fetchOrganizations]);

  useEffect(() => {
    void Promise.resolve().then(() => fetchStats());
  }, [fetchStats]);

  useEffect(() => {
    if (!socket) return;

    const handleUpdated = () => {
      fetchContacts();
      fetchStats();
    };

    socket.on("contact.updated", handleUpdated);
    socket.on("contact.deleted", handleUpdated);
    socket.on("contact.merged", handleUpdated);
    socket.on("contact.favorite", handleUpdated);
    socket.on("contact.pinned", handleUpdated);
    socket.on("sync:completed", handleUpdated);

    const handleWindowRefresh = () => {
      if (activeView === "contacts") fetchContacts();
      else fetchOrganizations();
      fetchStats();
    };
    window.addEventListener("refresh-data", handleWindowRefresh);

    return () => {
      socket.off("contact.updated", handleUpdated);
      socket.off("contact.deleted", handleUpdated);
      socket.off("contact.merged", handleUpdated);
      socket.off("contact.favorite", handleUpdated);
      socket.off("contact.pinned", handleUpdated);
      socket.off("sync:completed", handleUpdated);
      window.removeEventListener("refresh-data", handleWindowRefresh);
    };
  }, [socket, fetchContacts, fetchStats, activeView, fetchOrganizations]);

  const toggleFavorite = async (contact: Contact) => {
    const newVal = !contact.favorite;
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, favorite: newVal } : c));
    try {
      await api.patch(`/contacts/${contact.id}`, { favorite: newVal });
    } catch {
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, favorite: !newVal } : c));
      toast.error("Failed to update favorite");
    }
  };

  const togglePin = async (contact: Contact) => {
    const newVal = !contact.pinned;
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, pinned: newVal } : c));
    try {
      await api.patch(`/contacts/${contact.id}`, { pinned: newVal });
    } catch {
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, pinned: !newVal } : c));
      toast.error("Failed to update pin");
    }
  };

  const handleArchive = async (contact: Contact) => {
    setContacts(prev => prev.filter(c => c.id !== contact.id));
    try {
      await api.post(`/contacts/${contact.id}/archive`);
      toast.success("Contact archived");
      fetchStats();
    } catch {
      fetchContacts();
      toast.error("Failed to archive contact");
    }
  };

  const activeFilter = FILTER_OPTIONS.find(f => f.value === filter) || FILTER_OPTIONS[0];

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Network
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            {total > 0 ? `${total} contacts in your network` : "Manage your network and relationships."}
          </p>
        </div>

        <div className="flex w-full sm:w-auto items-center gap-1 rounded-lg bg-zinc-100/80 p-1 dark:bg-zinc-800/80 shrink-0 border border-zinc-200/50 dark:border-zinc-700/50">
          <button
            onClick={() => setActiveView("contacts")}
            className={cn(
              "flex flex-1 sm:flex-none justify-center items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all cursor-pointer",
              activeView === "contacts"
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-600"
                : "text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-200"
            )}
          >
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">Contacts</span>
          </button>
          <button
            onClick={() => setActiveView("organizations")}
            className={cn(
              "flex flex-1 sm:flex-none justify-center items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all cursor-pointer",
              activeView === "organizations"
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-600"
                : "text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-200"
            )}
          >
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">Organizations</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Total", value: stats?.total, icon: Users, accent: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400" },
          { label: "Favorites", value: stats?.favorites, icon: Star, accent: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400" },
          { label: "Pinned", value: stats?.pinned, icon: Pin, accent: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" },
          { label: "Active (7d)", value: stats?.recentActive, icon: TrendingUp, accent: "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400" },
          { label: "With Org", value: stats?.withOrg, icon: Building2, accent: "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400" },
        ].map((card) => (
          <div
            key={card.label}
            className={cn(
              "relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border p-3 sm:p-4 shadow-md dark:shadow-xl bg-white dark:bg-zinc-900",
              card.accent
            )}
          >
            <div className="rounded-lg bg-black/5 p-2 dark:bg-white/10 shrink-0">
              <card.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              {loading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <p className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tabular-nums truncate">
                  {card.value ?? "—"}
                </p>
              )}
              <p className="text-xs opacity-80 truncate">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder={activeView === "contacts" ? "Search contacts by name, email, company, notes..." : "Search organizations by name or domain..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-orange-400 focus:ring-1 focus:ring-orange-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-orange-500"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {activeView === "contacts" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn("gap-2 cursor-pointer", showFilters && "border-orange-400 text-orange-600 dark:text-orange-400")}
            >
              <Filter className="h-4 w-4" />
              {activeFilter.label}
              <ChevronDown className={cn("h-3 w-3 transition-transform", showFilters && "rotate-180")} />
            </Button>

            <div className="relative">
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value); setPage(1); }}
                className="appearance-none cursor-pointer rounded-lg border border-zinc-200 bg-white pl-3 pr-8 py-2 text-sm outline-none transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {activeView === "contacts" && showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="w-full mb-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Quick Filters</p>
              </div>
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setFilter(opt.value); setPage(1); }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    filter === opt.value
                      ? "bg-orange-500 text-white"
                      : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  )}
                >
                  <opt.icon className="h-3 w-3" />
                  {opt.label}
                </button>
              ))}

              <div className="w-full mt-3 mb-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Relationship</p>
              </div>
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setRelationship(opt.value); setPage(1); }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    relationship === opt.value
                      ? "bg-orange-500 text-white"
                      : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-h-0">
        {activeView === "contacts" ? (
          loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-zinc-300 bg-white shadow-md p-5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-xl">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <EmptyState
              icon={Users}
              title={debouncedSearch || filter ? "No Contacts Found" : "No Contacts Yet"}
              description={
                debouncedSearch || filter
                  ? "Try adjusting your search or filters."
                  : "Contacts will appear here automatically as you sync emails."
              }
              action={
                (debouncedSearch || filter) ? (
                  <Button
                    variant="outline"
                    onClick={() => { setSearch(""); setFilter(""); setRelationship(""); }}
                  >
                    Clear Filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence>
                  {contacts.map((contact) => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onFavorite={() => toggleFavorite(contact)}
                      onPin={() => togglePin(contact)}
                      onEdit={() => setEditContact(contact)}
                      onArchive={() => handleArchive(contact)}
                      onMerge={() => setMergeContact(contact)}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )
        ) : (
          orgLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-zinc-300 bg-white shadow-md p-5 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-xl">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-24 mb-4" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          ) : organizations.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={debouncedSearch ? "No Organizations Found" : "No Organizations Yet"}
              description={
                debouncedSearch
                  ? "Try a different search term."
                  : "Organizations are automatically identified from your contacts' domains."
              }
              action={
                debouncedSearch ? (
                  <Button variant="outline" onClick={() => setSearch("")}>Clear Search</Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <AnimatePresence>
                  {organizations.map((org) => (
                    <motion.div
                      key={org.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-zinc-300 bg-white p-5 shadow-md transition-all hover:shadow-lg hover:border-zinc-400 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-xl dark:hover:border-zinc-700 flex flex-col"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{org.name}</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{org.domain}</p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-sm text-zinc-500">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-zinc-400" />
                          {org._count.contacts} contacts
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {orgTotalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={orgPage <= 1}
                    onClick={() => setOrgPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    Page {orgPage} of {orgTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={orgPage >= orgTotalPages}
                    onClick={() => setOrgPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )
        )}
      </div>

      {editContact && (
        <ContactEditModal
          contact={editContact}
          onClose={() => setEditContact(null)}
          onSaved={() => { fetchContacts(); fetchStats(); setEditContact(null); }}
        />
      )}
      {mergeContact && (
        <MergeContactsModal
          contact={mergeContact}
          onClose={() => setMergeContact(null)}
          onMerged={() => { fetchContacts(); fetchStats(); setMergeContact(null); }}
        />
      )}
    </div>
  );
}
