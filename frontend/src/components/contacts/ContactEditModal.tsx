"use client";

import { useState } from "react";
import { X, Save, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Contact } from "./Contacts";

const RELATIONSHIP_OPTIONS = [
  { value: "", label: "None" },
  { value: "CLIENT", label: "Client" },
  { value: "CUSTOMER", label: "Customer" },
  { value: "SUPPLIER", label: "Supplier" },
  { value: "PARTNER", label: "Partner" },
  { value: "INTERNAL", label: "Internal" },
  { value: "OTHER", label: "Other" },
];

interface ContactEditModalProps {
  contact: Contact;
  onClose: () => void;
  onSaved: () => void;
}

export function ContactEditModal({ contact, onClose, onSaved }: ContactEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    displayName: contact.displayName || "",
    phoneNumber: contact.phoneNumber || "",
    jobTitle: contact.jobTitle || "",
    company: contact.company || "",
    relationship: contact.relationship || "",
    preferredTone: contact.preferredTone || "",
    customNotes: contact.customNotes || "",
    linkedinUrl: contact.linkedinUrl || "",
    website: contact.website || "",
    twitterUrl: contact.twitterUrl || "",
    labels: contact.labels.join(", "),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        displayName: form.displayName || null,
        phoneNumber: form.phoneNumber || null,
        jobTitle: form.jobTitle || null,
        company: form.company || null,
        relationship: form.relationship || null,
        preferredTone: form.preferredTone || null,
        customNotes: form.customNotes || null,
        linkedinUrl: form.linkedinUrl || null,
        website: form.website || null,
        twitterUrl: form.twitterUrl || null,
        labels: form.labels.split(",").map(l => l.trim()).filter(Boolean),
      };

      await api.patch(`/contacts/${contact.id}`, data);
      toast.success("Contact updated");
      onSaved();
    } catch {
      toast.error("Failed to update contact");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-orange-400 focus:ring-1 focus:ring-orange-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Edit Contact</h2>
          <button onClick={onClose} className="cursor-pointer rounded-md p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Display Name</label>
              <input className={inputClass} value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Phone</label>
              <input className={inputClass} value={form.phoneNumber} onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Job Title</label>
              <input className={inputClass} value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Company</label>
              <input className={inputClass} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Relationship</label>
              <div className="relative">
                <select className={`${inputClass} appearance-none cursor-pointer pr-8`} value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}>
                  {RELATIONSHIP_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Preferred AI Tone</label>
              <input className={inputClass} placeholder="e.g. professional, friendly" value={form.preferredTone} onChange={e => setForm(f => ({ ...f, preferredTone: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">LinkedIn URL</label>
            <input className={inputClass} placeholder="https://linkedin.com/in/..." value={form.linkedinUrl} onChange={e => setForm(f => ({ ...f, linkedinUrl: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Website</label>
              <input className={inputClass} placeholder="https://..." value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Twitter</label>
              <input className={inputClass} placeholder="https://twitter.com/..." value={form.twitterUrl} onChange={e => setForm(f => ({ ...f, twitterUrl: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Labels (comma-separated)</label>
            <input className={inputClass} placeholder="vip, engineering, priority" value={form.labels} onChange={e => setForm(f => ({ ...f, labels: e.target.value }))} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Notes</label>
            <textarea
              className={`${inputClass} min-h-[80px] resize-none`}
              value={form.customNotes}
              onChange={e => setForm(f => ({ ...f, customNotes: e.target.value }))}
              placeholder="Personal notes about this contact..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
