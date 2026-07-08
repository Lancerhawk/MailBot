"use client";

import Link from "next/link";
import Image from "next/image";

export default function LandingFooter() {
  return (
    <footer className="relative z-10 border-t border-zinc-200 dark:border-zinc-800/50 bg-zinc-50 dark:bg-[#0a0a14]/40 pt-16 pb-8 px-6 mt-auto transition-colors duration-500">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="flex h-8 w-8 items-center justify-center">
              <Image src="/logo.png" alt="MailBot Logo" width={32} height={32} className="h-full w-full object-contain" unoptimized />
            </div>
            <span className="font-bold tracking-tight text-zinc-900 dark:text-white text-xl">MailBot</span>
          </Link>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed max-w-xs">
            The next-generation AI email assistant. Leverage real-time synchronization and intelligent drafting to take back your time.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h4 className="font-semibold text-zinc-900 dark:text-white">Product</h4>
          <Link href="/#features" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors">Features</Link>
          <Link href="/pricing" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors">Pricing</Link>
          <Link href="/changelog" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors">Changelog</Link>
          <Link href="/reviews" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors">Reviews</Link>
        </div>

        <div className="flex flex-col gap-4">
          <h4 className="font-semibold text-zinc-900 dark:text-white">Resources</h4>
          <Link href="/docs" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors">Documentation</Link>
          <Link href="/faq" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors">FAQ</Link>
          <Link href="/blog" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors">Blog</Link>
          <Link href="/support" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors">Support</Link>
        </div>

        <div className="flex flex-col gap-4">
          <h4 className="font-semibold text-zinc-900 dark:text-white">Legal</h4>
          <Link href="/privacy" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors">Terms of Service</Link>
          <Link href="/cookies" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors">Cookie Policy</Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-zinc-200 dark:border-zinc-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          &copy; {new Date().getFullYear()} MailBot, Inc. All rights reserved.
        </p>
        <div className="flex gap-4">
          {/* Social icons can go here */}
        </div>
      </div>
    </footer>
  );
}
