"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Lock, Settings as SettingsIcon, ShieldAlert } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { Skeleton } from "@/components/ui/skeleton";
import * as Tooltip from "@radix-ui/react-tooltip";

const TooltipWrapper = ({ children, content }: { children: React.ReactNode; content: string }) => (
  <Tooltip.Provider delayDuration={100}>
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <div className="cursor-not-allowed group relative">{children}</div>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={5}
          className="bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 px-3 py-1.5 rounded-lg text-sm shadow-xl z-50 animate-in fade-in-0 zoom-in-95"
        >
          {content}
          <Tooltip.Arrow className="fill-zinc-900 dark:fill-zinc-100" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
);

const ComingSoonBadge = () => (
  <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30">
    Coming Soon
  </span>
);

interface SettingFieldProps {
  label: string;
  description: string;
  value: string | boolean | number | null;
  type: "text" | "boolean" | "select" | "number";
}

const SettingField = ({ label, description, value, type }: SettingFieldProps) => {
  const displayValue = typeof value === "boolean" ? (value ? "ON" : "OFF") : value ?? "Not configured";

  return (
    <TooltipWrapper content="This feature will be available in a future MailBot release.">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-zinc-300 dark:border-zinc-700/50 shadow-sm bg-zinc-50/50 dark:bg-zinc-900/30 opacity-70 transition-opacity hover:opacity-100">
        <div className="flex-1">
          <div className="flex items-center">
            <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{label}</label>
            <ComingSoonBadge />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 pr-4">{description}</p>
        </div>

        <div className="flex-shrink-0 flex items-center justify-end min-w-[120px]">
          {type === "boolean" ? (
            <div className="flex items-center h-8 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 shadow-inner overflow-hidden">
              <div className={`h-full w-1/2 flex items-center justify-center text-xs font-bold ${!value ? "bg-zinc-400 text-white shadow-sm" : "text-transparent"}`}>
                {!value ? "OFF" : ""}
              </div>
              <div className={`h-full w-1/2 flex items-center justify-center text-xs font-bold ${value ? "bg-orange-500 text-white shadow-sm" : "text-transparent"}`}>
                {value ? "ON" : ""}
              </div>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 text-sm font-medium shadow-sm w-full sm:w-auto text-center min-w-[100px] truncate max-w-[200px]">
              {displayValue}
            </div>
          )}
          <Lock className="w-3.5 h-3.5 text-zinc-400 ml-3" />
        </div>
      </div>
    </TooltipWrapper>
  );
};

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="flex flex-col gap-8 h-full w-full pb-20">
        <div className="space-y-4">
          <Skeleton className="h-10 w-48 bg-zinc-200 dark:bg-zinc-800" />
          <Skeleton className="h-4 w-96 bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        <Skeleton className="h-64 w-full rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        <Skeleton className="h-64 w-full rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
    );
  }

  const settings = user?.settings;

  return (
    <div className="flex flex-col gap-8 h-full w-full pb-20">

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center">
          <SettingsIcon className="w-8 h-8 mr-3 text-orange-500" />
          Settings
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          Manage your account settings, AI preferences, and automation rules.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Settings Banner */}
        <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-6 shadow-md dark:shadow-xl relative overflow-hidden flex flex-col justify-center min-h-[160px]">
          <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-[0.08] dark:opacity-10 pointer-events-none">
            <ShieldAlert className="w-24 h-24 text-orange-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-8 h-8 bg-orange-100 border border-orange-200 dark:border-transparent dark:bg-orange-500/20 rounded-lg text-lg">
                ⚙️
              </div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-wide">Upcoming Settings</h2>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed max-w-md">
              Some settings shown below are securely stored, but their functionality is still under development. They are displayed for preview purposes and will become fully configurable in future releases.
            </p>
          </div>
        </div>

        {/* Account Profile Card */}
        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-300 dark:border-zinc-800/80 rounded-2xl p-6 shadow-md flex flex-col justify-center relative overflow-hidden min-h-[160px]">
          <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-10 dark:opacity-5 pointer-events-none">
            <SettingsIcon className="w-40 h-40 text-zinc-900 dark:text-white" />
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10">
            <div className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center overflow-hidden shrink-0 border-2 border-orange-500/20 shadow-sm">
              {user?.avatarUrl ? (
                <Image src={user.avatarUrl} alt="Avatar" width={80} height={80} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
                </span>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <h4 className="text-xl font-bold text-zinc-900 dark:text-white">{user?.name || "User"}</h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{user?.email}</p>
              <div className="pt-1 flex justify-center sm:justify-start">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${user?.hasGmailAccess ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${user?.hasGmailAccess ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-red-500"}`}></span>
                  {user?.hasGmailAccess ? "Gmail Connected" : "Gmail Disconnected"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">

        <section className="bg-white dark:bg-zinc-900/40 border border-zinc-300 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-md">
          <div className="px-6 py-4 border-b border-zinc-300 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/80">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">General</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Core account preferences and AI engine selection.</p>
          </div>
          <div className="p-6 space-y-4">
            <SettingField label="Preferred AI Provider" description="The LLM provider powering MailBot's intelligence (e.g., GROQ, OPENAI)." value={settings?.preferredAiProvider || "GROQ"} type="select" />
            <SettingField label="Preferred AI Model" description="The specific language model used for processing." value={settings?.preferredAiModel || "llama3-70b-8192"} type="select" />
            <SettingField label="Draft Approval Mode" description="Whether drafted emails require manual review or are auto-sent." value={settings?.draftApprovalMode || "MANUAL"} type="select" />
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900/40 border border-zinc-300 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-md">
          <div className="px-6 py-4 border-b border-zinc-300 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/80">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Automation</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Configure how autonomously MailBot should operate.</p>
          </div>
          <div className="p-6 space-y-4">
            <SettingField label="Auto Reply Engine" description="Automatically generate and send replies to incoming emails." value={false} type="boolean" />
            <SettingField label="Confidence Threshold" description="Minimum AI confidence required to auto-approve a draft (0.0 to 1.0)." value={settings?.confidenceThreshold ?? 0.85} type="number" />
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900/40 border border-zinc-300 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-md">
          <div className="px-6 py-4 border-b border-zinc-300 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/80">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Business Hours</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Restrict automated replies to specific working hours.</p>
          </div>
          <div className="p-6 space-y-4">
            <SettingField label="Start Time" description="When MailBot begins processing automated replies." value={settings?.businessHoursStart || "09:00"} type="text" />
            <SettingField label="End Time" description="When MailBot stops processing automated replies." value={settings?.businessHoursEnd || "17:00"} type="text" />
            <SettingField label="Timezone" description="The timezone used for evaluating business hours." value={settings?.businessHoursTimezone || "UTC"} type="select" />
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900/40 border border-zinc-300 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-md">
          <div className="px-6 py-4 border-b border-zinc-300 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/80">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Signature</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Custom signature appended to all AI-generated drafts.</p>
          </div>
          <div className="p-6 space-y-4">
            <SettingField label="Reply Signature" description="Text or HTML injected at the bottom of automated replies." value={settings?.replySignature || "Sent by MailBot AI"} type="text" />
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900/40 border border-zinc-300 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-md">
          <div className="px-6 py-4 border-b border-zinc-300 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/80">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Notifications</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Manage system alerts and communication preferences.</p>
          </div>
          <div className="p-6 space-y-4">
            <SettingField label="Notify On New Email" description="Receive alerts when important emails are received." value={false} type="boolean" />
            <SettingField label="Notify On Draft Ready" description="Receive alerts when a new AI draft is ready for review." value={false} type="boolean" />
            <SettingField label="Notify On Errors" description="Receive immediate alerts if a system or sync error occurs." value={false} type="boolean" />
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900/40 border border-zinc-300 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-md">
          <div className="px-6 py-4 border-b border-zinc-300 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/80">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Advanced</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Developer-level configuration and overrides.</p>
          </div>
          <div className="p-6 space-y-4">
            <SettingField label="Dynamic Config" description="Raw JSON configuration for experimental engine flags." value={settings?.dynamicConfig ? (typeof settings.dynamicConfig === 'string' ? settings.dynamicConfig : JSON.stringify(settings.dynamicConfig)) : "{}"} type="text" />
          </div>
        </section>

      </div>
    </div>
  );
}
