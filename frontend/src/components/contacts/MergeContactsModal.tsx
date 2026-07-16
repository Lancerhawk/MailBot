"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Merge, Loader2, Search, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Contact } from "./Contacts";

interface MergeContactsModalProps {
  contact: Contact;
  onClose: () => void;
  onMerged: () => void;
}

export function MergeContactsModal({ contact, onClose, onMerged }: MergeContactsModalProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [merging, setMerging] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get(`/contacts?search=${encodeURIComponent(q)}&limit=10`);
      setResults((res.data.data as Contact[]).filter((c: Contact) => c.id !== contact.id));
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  }, [contact.id]);

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(t);
  }, [search, doSearch]);

  const handleMerge = async () => {
    if (!selected) return;
    setMerging(true);
    try {
      await api.post(`/contacts/${contact.id}/merge`, { secondaryId: selected.id });
      toast.success("Contacts merged successfully");
      onMerged();
    } catch {
      toast.error("Failed to merge contacts");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Merge Contact</h2>
          <button onClick={onClose} className="cursor-pointer rounded-md p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-500/5">
            <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">Primary (will be kept)</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{contact.displayName || contact.emailAddress}</p>
            <p className="text-xs text-zinc-500">{contact.emailAddress}</p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              The secondary contact will be merged into the primary. All email history and participants will be moved. This action cannot be undone.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Search for contact to merge</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-orange-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </div>
          </div>

          <div className="max-h-[200px] overflow-y-auto space-y-1">
            {searching && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            )}
            {!searching && results.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                  selected?.id === c.id
                    ? "border-orange-400 bg-orange-50 dark:border-orange-600 dark:bg-orange-500/10"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                )}
              >
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{c.displayName || c.emailAddress}</p>
                <p className="text-xs text-zinc-500">{c.emailAddress}</p>
              </button>
            ))}
            {!searching && search.length >= 2 && results.length === 0 && (
              <p className="text-center text-sm text-zinc-400 py-4">No contacts found</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleMerge}
            disabled={!selected || merging}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {merging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Merge className="mr-2 h-4 w-4" />}
            Merge Contacts
          </Button>
        </div>
      </div>
    </div>
  );
}
