"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2 } from "lucide-react";
import changelogData from "../../data/changelog.json";

interface Feature {
  title: string;
  description: string;
}

interface Version {
  id: string;
  version: string;
  service: string;
  date: string;
  title: string;
  isCurrent: boolean;
  features: Feature[];
}

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
  const versions = changelogData.versions as Version[];
  const frontendVersions = versions.filter(v => v.service === "Frontend");
  const backendVersions = versions.filter(v => v.service === "Backend");
  const [selectedVersion, setSelectedVersion] = useState<Version>(frontendVersions[0] || versions[0]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="relative w-full max-w-5xl h-[85vh] max-h-[800px] flex flex-col bg-zinc-50 dark:bg-[#0a0a14] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center">
                <Image src="/logo.png" alt="MailBot Logo" width={32} height={32} className="h-full w-full object-contain" unoptimized />
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">MailBot</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Version History</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 cursor-pointer rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            
            {/* Sidebar */}
            <div className="w-1/3 max-w-[280px] h-full flex flex-col border-r border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#06060c]">
              
              {/* Frontend Section */}
              <div className="flex-1 flex flex-col overflow-hidden pt-4 pb-2 border-b border-zinc-200 dark:border-zinc-800/80">
                <h3 className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase mb-3 px-7 flex items-center gap-2 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  Frontend
                </h3>
                <div className="flex-1 overflow-y-auto px-4 custom-scrollbar space-y-1">
                  {frontendVersions.map((ver) => {
                    const isActive = selectedVersion.id === ver.id;
                    return (
                      <button
                        key={ver.id}
                        onClick={() => setSelectedVersion(ver)}
                        className={`w-full cursor-pointer text-left px-3 py-3 rounded-xl transition-all duration-200 ${
                          isActive 
                            ? "bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/20" 
                            : "hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-bold ${isActive ? "text-white" : "text-zinc-900 dark:text-zinc-200"}`}>
                            {ver.version}
                          </span>
                          {ver.isCurrent && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              isActive ? "bg-white/20 text-white" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            }`}>
                              Current
                            </span>
                          )}
                        </div>
                        <p className={`text-xs truncate ${isActive ? "text-blue-100" : "text-zinc-500"}`}>
                          {ver.title}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Backend Section */}
              <div className="flex-1 flex flex-col overflow-hidden pt-4 pb-2">
                <h3 className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase mb-3 px-7 flex items-center gap-2 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                  Backend
                </h3>
                <div className="flex-1 overflow-y-auto px-4 custom-scrollbar space-y-1">
                  {backendVersions.map((ver) => {
                    const isActive = selectedVersion.id === ver.id;
                    return (
                      <button
                        key={ver.id}
                        onClick={() => setSelectedVersion(ver)}
                        className={`w-full cursor-pointer text-left px-3 py-3 rounded-xl transition-all duration-200 ${
                          isActive 
                            ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                            : "hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-bold ${isActive ? "text-white" : "text-zinc-900 dark:text-zinc-200"}`}>
                            {ver.version}
                          </span>
                          {ver.isCurrent && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              isActive ? "bg-white/20 text-white" : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                            }`}>
                              Current
                            </span>
                          )}
                        </div>
                        <p className={`text-xs truncate ${isActive ? "text-orange-100" : "text-zinc-500"}`}>
                          {ver.title}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 h-full overflow-y-auto bg-white dark:bg-[#0a0a14] p-8 md:p-12 custom-scrollbar">
              <div className="max-w-2xl mx-auto">
                
                <div className="flex items-center gap-3 mb-6">
                  <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
                    {selectedVersion.title}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {selectedVersion.version} · {selectedVersion.service}
                  </span>
                </div>

                <p className="text-sm text-zinc-500 dark:text-zinc-500 mb-10">
                  Released: {selectedVersion.date}
                </p>

                <h3 className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase mb-6">
                  What's Included
                </h3>

                <div className="space-y-8">
                  {selectedVersion.features.map((feature, idx) => (
                    <div key={idx} className="flex gap-4 group">
                      <div className="mt-0.5 shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-[#5865F2] opacity-80 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                          {feature.title}
                        </h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
