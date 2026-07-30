"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "../../providers/AuthProvider";
import { Button } from "../ui/button";
import { Moon, Sun, ChevronDown, LogOut, LayoutDashboard, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";

export default function LandingNavbar() {
  const { user, logout, setLoading } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        setScrollProgress(Math.min((window.scrollY / totalHeight) * 100, 100));
      }
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  const handleGoogleLogin = () => {
    setLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    window.location.href = `${apiUrl}/auth/google`;
  };

  const navLinks = [
    { href: "/#features", label: "Features" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/faq", label: "FAQ" },
  ];

  return (
    <>
      <header className={`fixed left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-5xl rounded-full px-4 py-2 flex items-center justify-between transition-all duration-300 ${isScrolled ? 'top-4 border border-zinc-200/80 dark:border-zinc-800/60 bg-white/80 dark:bg-[#0a0a14]/80 backdrop-blur-xl shadow-2xl shadow-black/5 dark:shadow-black/30' : 'top-6 border-transparent bg-transparent'}`}>
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8 lg:gap-12">
          <Link href="/" className="flex items-center gap-2 pl-2 hover:opacity-80 transition-opacity">
            <div className="flex h-7 w-7 items-center justify-center">
              <Image src="/logo.png" alt="MailBot Logo" width={28} height={28} className="h-full w-full object-contain" unoptimized />
            </div>
            <span className="font-bold tracking-tight text-zinc-900 dark:text-white text-lg">MailBot</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative py-1 hover:text-zinc-900 dark:hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-orange-500 after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle theme"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700/50 transition-colors"
          >
            {mounted && isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <div className="hidden md:block">
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  className="flex items-center cursor-pointer gap-2 outline-none group bg-transparent border-none p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  {user.avatarUrl ? (
                    <Image src={user.avatarUrl} alt="Avatar" width={28} height={28} className="h-7 w-7 rounded-full object-cover border border-zinc-200 dark:border-zinc-700/50" unoptimized />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-xs font-bold text-white shadow-inner">
                      {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </div>
                  )}
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                    {user.name?.split(' ')[0] || 'Account'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 top-full mt-2 w-64 origin-top-right rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white/95 dark:bg-[#0a0a14]/95 backdrop-blur-xl p-2 shadow-2xl shadow-black/10 dark:shadow-black/50 overflow-hidden"
                    >
                      <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50">
                        {user.avatarUrl ? (
                          <Image src={user.avatarUrl} alt="Avatar" width={40} height={40} className="h-10 w-10 rounded-full object-cover border border-zinc-700" unoptimized />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-lg font-bold text-white shadow-inner">
                            {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{user.name || 'User'}</span>
                          <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user.email}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => { setIsMenuOpen(false); router.push('/dashboard'); }}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition-colors"
                      >
                        <LayoutDashboard className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                        Dashboard
                      </button>

                      <div className="my-1.5 h-px w-full bg-zinc-200 dark:bg-zinc-800/50" />

                      <button
                        onClick={() => { setIsMenuOpen(false); logout(); }}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                      >
                        <LogOut className="h-4 w-4 text-red-500 dark:text-red-400/80" />
                        Log out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Button onClick={handleGoogleLogin} className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 shadow-sm cursor-pointer h-8 px-5 text-sm font-bold transition-all">
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile: Hamburger */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="flex md:hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Scroll Progress Indicator */}
        <div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-zinc-200/50 dark:bg-zinc-800/30 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
            style={{ width: `${scrollProgress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setIsMobileOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 z-50 h-full w-[280px] bg-white dark:bg-[#0a0a14] border-l border-zinc-200 dark:border-zinc-800/50 shadow-2xl md:hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <Image src="/logo.png" alt="MailBot" width={24} height={24} className="h-6 w-6 object-contain" unoptimized />
                  <span className="font-bold text-zinc-900 dark:text-white">MailBot</span>
                </div>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex flex-col p-4 gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileOpen(false)}
                    className="flex items-center px-4 py-3 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-auto p-4 border-t border-zinc-100 dark:border-zinc-800/50">
                {user ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
                      {user.avatarUrl ? (
                        <Image src={user.avatarUrl} alt="Avatar" width={32} height={32} className="h-8 w-8 rounded-full object-cover" unoptimized />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-sm font-bold text-white">
                          {user.name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{user.name || 'User'}</span>
                        <span className="truncate text-xs text-zinc-500">{user.email}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { setIsMobileOpen(false); router.push('/dashboard'); }}
                      className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </button>
                    <button
                      onClick={() => { setIsMobileOpen(false); logout(); }}
                      className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                ) : (
                  <Button onClick={() => { setIsMobileOpen(false); handleGoogleLogin(); }} className="w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 h-10 font-bold transition-all">
                    Sign In
                  </Button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
