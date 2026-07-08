"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import ChangelogModal from "../modals/ChangelogModal";

export default function ChangelogWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 z-[40] group cursor-pointer flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/90 dark:bg-[#0a0a14]/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all duration-300 hover:scale-105"
      >
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-500 group-hover:bg-orange-500/20 transition-colors">
          <Sparkles className="w-3 h-3" />
        </div>
        <span className="text-xs font-bold tracking-widest uppercase">Changelog</span>
      </button>

      <ChangelogModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
