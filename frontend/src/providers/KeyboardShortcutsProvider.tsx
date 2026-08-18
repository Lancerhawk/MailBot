"use client";

import React, { useEffect, useCallback, createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "@/lib/toast";

interface KeyboardShortcutsContextType {
  isComposeOpen: boolean;
  setIsComposeOpen: (open: boolean) => void;
  showShortcutsHelp: boolean;
  setShowShortcutsHelp: (open: boolean) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType>({
  isComposeOpen: false,
  setIsComposeOpen: () => { },
  showShortcutsHelp: false,
  setShowShortcutsHelp: () => { },
});

export const useKeyboardShortcuts = () => useContext(KeyboardShortcutsContext);

const SHORTCUTS = [
  { key: "c", label: "Compose new email", section: "Actions" },
  { key: "r", label: "Refresh data", section: "Actions" },
  { key: "/", label: "Focus search", section: "Actions" },
  { key: "g then i", label: "Go to Inbox", section: "Navigation" },
  { key: "g then d", label: "Go to Dashboard", section: "Navigation" },
  { key: "g then k", label: "Go to Knowledge Base", section: "Navigation" },
  { key: "g then a", label: "Go to Analytics", section: "Navigation" },
  { key: "g then s", label: "Go to Settings", section: "Navigation" },
  { key: "g then o", label: "Go to Contacts", section: "Navigation" },
  { key: "t", label: "Toggle dark/light theme", section: "Actions" },
  { key: "?", label: "Show keyboard shortcuts", section: "Help" },
  { key: "Esc", label: "Close dialogs", section: "Help" },
];

export { SHORTCUTS };

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [awaitingGoKey, setAwaitingGoKey] = useState(false);

  const isInputFocused = useCallback(() => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if ((el as HTMLElement).isContentEditable) return true;
    return false;
  }, []);

  useEffect(() => {
    let goTimer: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Never intercept when user is typing in an input
      if (isInputFocused()) return;

      // Don't intercept if modifier keys are held (allow browser shortcuts)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // "g" prefix for navigation
      if (awaitingGoKey) {
        setAwaitingGoKey(false);
        if (goTimer) clearTimeout(goTimer);

        switch (key) {
          case "i": e.preventDefault(); router.push("/inbox"); return;
          case "d": e.preventDefault(); router.push("/dashboard"); return;
          case "k": e.preventDefault(); router.push("/knowledge-base"); return;
          case "a": e.preventDefault(); router.push("/analytics"); return;
          case "s": e.preventDefault(); router.push("/settings"); return;
          case "o": e.preventDefault(); router.push("/contacts"); return;
          default: return;
        }
      }

      switch (key) {
        case "g":
          e.preventDefault();
          setAwaitingGoKey(true);
          goTimer = setTimeout(() => setAwaitingGoKey(false), 1500);
          toast.success("Go to... (i=Inbox, d=Dashboard, k=KB, a=Analytics, s=Settings, o=Contacts)");
          return;

        case "c":
          e.preventDefault();
          setIsComposeOpen(true);
          return;

        case "r":
          e.preventDefault();
          window.dispatchEvent(new Event("refresh-data"));
          router.refresh();
          toast.success("Refreshing...");
          return;

        case "/":
          e.preventDefault();
          // Focus the search input if it exists on the page
          const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
          if (searchInput) {
            searchInput.focus();
          }
          return;

        case "t":
          e.preventDefault();
          setTheme(isDark ? "light" : "dark");
          return;

        case "?":
          e.preventDefault();
          setShowShortcutsHelp(prev => !prev);
          return;

        case "escape":
          setShowShortcutsHelp(false);
          setIsComposeOpen(false);
          return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (goTimer) clearTimeout(goTimer);
    };
  }, [awaitingGoKey, isInputFocused, isDark, router, setTheme]);

  return (
    <KeyboardShortcutsContext.Provider value={{ isComposeOpen, setIsComposeOpen, showShortcutsHelp, setShowShortcutsHelp }}>
      {children}

      {/* Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowShortcutsHelp(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                <span className="text-xs">ESC</span>
              </button>
            </div>

            {["Actions", "Navigation", "Help"].map((section) => (
              <div key={section} className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">{section}</h3>
                <div className="space-y-1.5">
                  {SHORTCUTS.filter(s => s.section === section).map((shortcut) => (
                    <div key={shortcut.key} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{shortcut.label}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.key.split(" then ").map((k, i) => (
                          <React.Fragment key={k}>
                            {i > 0 && <span className="text-[10px] text-zinc-400 mx-0.5">then</span>}
                            <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 px-1.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {k}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center">
                Press <kbd className="mx-0.5 inline-flex h-5 items-center rounded border border-zinc-200 bg-zinc-100 px-1 text-[10px] dark:border-zinc-700 dark:bg-zinc-800">?</kbd> anytime to toggle this help
              </p>
            </div>
          </div>
        </div>
      )}
    </KeyboardShortcutsContext.Provider>
  );
}
