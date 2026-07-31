"use client";

import { useAuth } from "../providers/AuthProvider";
import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import {
  Zap, Sparkles, LayoutDashboard, Mail, Brain, Shield,
  BarChart3, BookOpen, Tags, ArrowRight, Lock,
  ChevronRight, Globe, Server, Database, Cpu
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import LandingNavbar from "../components/layout/LandingNavbar";
import LandingFooter from "../components/layout/LandingFooter";
import ChangelogWidget from "../components/layout/ChangelogWidget";
import { motion, useInView } from "framer-motion";

function RevealSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ───────── Animated counter ───────── */
function AnimatedCounter({ value, suffix = "", label }: { value: string; suffix?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <span className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900 dark:text-white tabular-nums">
        {isInView ? value : "0"}{suffix}
      </span>
      <span className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-500 dark:text-zinc-500">{label}</span>
    </div>
  );
}

/* ───────── Fake inbox card (hero visual) ───────── */
function InboxMockup() {
  return (
    <div className="relative w-full max-w-[380px]">
      {/* Floating glow behind */}
      <div className="absolute -inset-8 bg-gradient-to-br from-orange-500/20 via-red-500/10 to-transparent rounded-3xl blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="relative rounded-2xl border border-zinc-200/80 dark:border-zinc-800/60 bg-white dark:bg-[#0c0c16] shadow-2xl shadow-black/5 dark:shadow-black/40 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/50">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
          </div>
          <span className="ml-2 text-[10px] font-semibold text-zinc-400 dark:text-zinc-600 tracking-wider uppercase">Inbox</span>
        </div>

        {/* Email rows */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
          {/* Row 1 — with AI draft indicator */}
          <div className="flex items-start gap-3 px-4 py-3.5 bg-orange-50/50 dark:bg-orange-500/5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 mt-0.5">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">Sarah from Acme Corp</span>
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500 text-white">AI DRAFT</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-500 truncate mt-0.5">Re: Partnership Proposal Q3</p>
            </div>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600 shrink-0 mt-1">2m</span>
          </div>

          {/* Row 2 */}
          <div className="flex items-start gap-3 px-4 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 mt-0.5">
              <Mail className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate block">Dev Team</span>
              <p className="text-xs text-zinc-500 dark:text-zinc-500 truncate mt-0.5">CI/CD pipeline update — all green ✓</p>
            </div>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600 shrink-0 mt-1">18m</span>
          </div>

          {/* Row 3 */}
          <div className="flex items-start gap-3 px-4 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 mt-0.5">
              <Mail className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 truncate block">Newsletter Weekly</span>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 truncate mt-0.5">Your weekly product digest is here</p>
            </div>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600 shrink-0 mt-1">1h</span>
          </div>
        </div>

        {/* Bottom bar — AI status */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-500">AI drafting reply for Sarah…</span>
        </div>
      </div>

      {/* Floating CRM card */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-6 -left-6 z-10 rounded-xl border border-zinc-200/80 dark:border-zinc-800/60 bg-white dark:bg-[#0c0c16] shadow-xl px-3.5 py-2.5"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <LayoutDashboard className="h-3 w-3" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">+3 contacts</p>
            <p className="text-[8px] text-zinc-400 dark:text-zinc-600">Auto-extracted</p>
          </div>
        </div>
      </motion.div>

      {/* Floating speed badge */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -top-4 -right-4 z-10 rounded-xl border border-zinc-200/80 dark:border-zinc-800/60 bg-white dark:bg-[#0c0c16] shadow-xl px-3 py-2"
      >
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3 w-3 text-orange-500" />
          <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">BGE-Small-EN-v1.5</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { user, setLoading } = useAuth();
  const [, setMousePos] = useState({ x: 0, y: 0 });

  const handleGoogleLogin = () => {
    setLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    window.location.href = `${apiUrl}/auth/google`;
  };

  // Track mouse for bento card glow effect
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      document.querySelectorAll('.bento-card').forEach((card) => {
        const rect = (card as HTMLElement).getBoundingClientRect();
        (card as HTMLElement).style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        (card as HTMLElement).style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
      });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col bg-zinc-50 dark:bg-[#06060c] text-zinc-900 dark:text-zinc-50 overflow-hidden font-sans selection:bg-orange-500/30 transition-colors duration-500">

      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-5%] w-[45%] h-[45%] rounded-full bg-orange-500/8 dark:bg-orange-600/10 blur-[150px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[35%] h-[35%] rounded-full bg-red-500/6 dark:bg-red-600/8 blur-[130px]" />
        <div className="absolute top-[50%] left-[40%] w-[25%] h-[25%] rounded-full bg-orange-400/4 dark:bg-orange-500/5 blur-[100px]" />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNikiLz48L3N2Zz4=")`,
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)'
          }}
        />
        <div
          className="absolute inset-0 block dark:hidden opacity-40"
          style={{
            backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wOCkiLz48L3N2Zz4=")`,
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)'
          }}
        />
      </div>

      <LandingNavbar />
      <section className="relative z-10 w-full min-h-[100vh] flex items-center pt-28 pb-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
          <div className="flex flex-col items-start gap-6">
            <motion.a
              href="https://github.com/Lancerhawk/MailBot"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
              </span>
              Open Source · Apache 2.0
            </motion.a>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] 2xl:text-6xl font-black tracking-tight leading-[1.08] text-zinc-900 dark:text-white">
                Stop managing email.
                <br />
                <span className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 dark:from-orange-400 dark:via-orange-500 dark:to-red-500 bg-clip-text text-transparent">
                  Let AI handle it.
                </span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
              className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-lg"
            >
              MailBot connects directly to your Gmail via Google Pub/Sub webhooks, syncs in real-time, auto-drafts intelligent replies with Groq LLMs, and builds a CRM from your conversations, all without you lifting a finger.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex flex-wrap items-center gap-3 mt-2"
            >
              {user ? (
                <Link href="/dashboard">
                  <Button
                    size="lg"
                    className="rounded-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg shadow-orange-500/20 h-12 px-7 gap-2.5 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    {user.avatarUrl ? (
                      <Image src={user.avatarUrl} alt="Avatar" width={24} height={24} className="h-6 w-6 rounded-full object-cover border border-white/30" unoptimized />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
                        {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                      </div>
                    )}
                    <span>Continue to Dashboard</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button
                  size="lg"
                  onClick={handleGoogleLogin}
                  className="rounded-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg shadow-orange-500/20 h-12 px-7 gap-2.5 font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="h-5 w-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Get Started with Google
                </Button>
              )}
              <a
                href="https://github.com/Lancerhawk/MailBot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-semibold text-zinc-800 dark:text-zinc-200 transition-all hover:scale-[1.02]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                Star on GitHub
              </a>
              <Link href="#features" className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors group">
                See features <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="flex flex-wrap items-center gap-4 mt-4 pt-6 border-t border-zinc-200/60 dark:border-zinc-800/40"
            >
              {[
                { icon: <Cpu className="h-3.5 w-3.5" />, text: "BGE-Small-EN-v1.5 Embedding" },
                { icon: <Lock className="h-3.5 w-3.5" />, text: "AES-256 encrypted" },
                { icon: <Shield className="h-3.5 w-3.5" />, text: "Zero data selling" },
              ].map((badge) => (
                <div key={badge.text} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/40 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {badge.icon}
                  {badge.text}
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center lg:justify-end"
          >
            <InboxMockup />
          </motion.div>
        </div>
      </section>

      <RevealSection className="relative z-10 w-full border-y border-zinc-200/60 dark:border-zinc-800/40 bg-white/50 dark:bg-[#0a0a14]/50 backdrop-blur-sm py-12 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <AnimatedCounter value="<100" suffix="ms" label="Sync Latency" />
          <AnimatedCounter value="Groq" suffix="" label="LLM Inference" />
          <AnimatedCounter value="AES-256" suffix="" label="Encryption" />
          <AnimatedCounter value="24/7" suffix="" label="Background Sync" />
        </div>
      </RevealSection>

      <section id="features" className="relative z-10 w-full py-24 sm:py-32 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <RevealSection className="max-w-2xl mb-16">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-orange-500 dark:text-orange-400 mb-3">Platform Features</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white leading-tight">
              Everything your inbox needs,
              <br className="hidden sm:block" />
              <span className="text-zinc-400 dark:text-zinc-600"> nothing it doesn&apos;t.</span>
            </h2>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <RevealSection delay={0.1} className="lg:row-span-2">
              <div className="bento-card h-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800/50 bg-white/70 dark:bg-[#0a0a14]/70 backdrop-blur-sm p-8 flex flex-col justify-between gap-8">
                <div>
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/15 mb-5">
                    <Zap className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">Real-Time Sync</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Direct webhook integration with Google Cloud Pub/Sub. The instant an email hits your Gmail, MailBot processes it has no polling, no delays, no missed messages.
                  </p>
                </div>
                {/* Visual — animated pulse dots */}
                <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/40">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">Live</span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-green-500/30 via-orange-500/20 to-transparent" />
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ scaleY: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                        className="w-1 h-4 rounded-full bg-orange-500/60 origin-bottom"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </RevealSection>

            {/* Card 2 — AI Drafting */}
            <RevealSection delay={0.2}>
              <div className="bento-card h-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800/50 bg-white/70 dark:bg-[#0a0a14]/70 backdrop-blur-sm p-7">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/15 mb-4">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">AI-Assisted Drafting</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Groq LPU-powered models analyze your conversations and instantly produce context-aware, ready-to-send replies. Review, tweak, send.
                </p>
              </div>
            </RevealSection>

            {/* Card 3 — Auto CRM */}
            <RevealSection delay={0.3}>
              <div className="bento-card h-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800/50 bg-white/70 dark:bg-[#0a0a14]/70 backdrop-blur-sm p-7">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/15 mb-4">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Automated CRM</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Every email builds your contact directory. Names, organizations, and interaction history are extracted and organized automatically.
                </p>
              </div>
            </RevealSection>

            {/* Card 4 — Knowledge Base */}
            <RevealSection delay={0.25}>
              <div className="bento-card h-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800/50 bg-white/70 dark:bg-[#0a0a14]/70 backdrop-blur-sm p-7">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15 mb-4">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Knowledge Base</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Feed the AI context about your business, products, and tone of voice. The more it knows, the smarter the drafts become.
                </p>
              </div>
            </RevealSection>

            {/* Card 5 — Analytics */}
            <RevealSection delay={0.35}>
              <div className="bento-card h-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800/50 bg-white/70 dark:bg-[#0a0a14]/70 backdrop-blur-sm p-7">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/15 mb-4">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Analytics Dashboard</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Track email volume, response times, category distributions, and AI draft acceptance rates with rich, interactive charts.
                </p>
              </div>
            </RevealSection>

            {/* Card 6 — Smart Categories */}
            <RevealSection delay={0.4}>
              <div className="bento-card h-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800/50 bg-white/70 dark:bg-[#0a0a14]/70 backdrop-blur-sm p-7">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/15 mb-4">
                  <Tags className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Smart Categories</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  AI automatically classifies incoming emails into categories, work, personal, notifications, newsletters, so your inbox stays organized.
                </p>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
         SECTION 4 — HOW IT WORKS
         ══════════════════════════════════════════════════════ */}
      <section className="relative z-10 w-full py-24 px-4 sm:px-6 border-t border-zinc-200/60 dark:border-zinc-800/40">
        <div className="max-w-5xl mx-auto">
          <RevealSection className="text-center mb-16">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-orange-500 dark:text-orange-400 mb-3">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
              Three steps. Zero effort.
            </h2>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-orange-500/30 via-red-500/30 to-orange-500/30" />

            {[
              {
                step: "01",
                icon: <Globe className="h-6 w-6" />,
                title: "Connect your Gmail",
                desc: "One-click Google OAuth. We request only the minimum scopes needed to read, compose, and metadata.",
                iconClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/15"
              },
              {
                step: "02",
                icon: <Brain className="h-6 w-6" />,
                title: "AI takes over",
                desc: "MailBot syncs your inbox in real-time, categorizes threads, extracts contacts, and drafts replies using Groq LLMs.",
                iconClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/15"
              },
              {
                step: "03",
                icon: <Sparkles className="h-6 w-6" />,
                title: "Review & send",
                desc: "Open your dashboard. AI drafts are ready and waiting. Review, edit if you want, and send, all from one place.",
                iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15"
              },
            ].map((item, i) => (
              <RevealSection key={item.step} delay={i * 0.15} className="relative">
                <div className="flex flex-col items-center text-center p-8 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/40 bg-white/40 dark:bg-[#0a0a14]/40 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-[#0a0a14]/60 transition-colors">
                  {/* Step number + icon */}
                  <div className={`relative flex items-center justify-center w-14 h-14 rounded-2xl border mb-5 ${item.iconClass}`}>
                    {item.icon}
                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 dark:bg-white text-[10px] font-black text-white dark:text-zinc-900">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
         SECTION 5 — TECH STACK / OPEN SOURCE
         ══════════════════════════════════════════════════════ */}
      <section className="relative z-10 w-full py-16 px-4 sm:px-6 bg-zinc-900 dark:bg-[#0a0a14] border-y border-zinc-800/50">
        <div className="max-w-5xl mx-auto">
          <RevealSection className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-bold text-white">Built with modern, open-source technologies.</h3>
              <p className="text-sm text-zinc-400 max-w-md">
                MailBot is fully open-source under the Apache 2.0 license. Inspect the code, self-host, or contribute.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {[
                { icon: <Globe className="h-4 w-4" />, label: "Next.js" },
                { icon: <Server className="h-4 w-4" />, label: "Node.js" },
                { icon: <Database className="h-4 w-4" />, label: "PostgreSQL" },
                { icon: <Cpu className="h-4 w-4" />, label: "Redis" },
                { icon: <Zap className="h-4 w-4" />, label: "Groq" },
                { icon: <Mail className="h-4 w-4" />, label: "Gmail API" },
              ].map((tech) => (
                <span key={tech.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-xs font-medium text-zinc-300">
                  {tech.icon} {tech.label}
                </span>
              ))}
            </div>
          </RevealSection>

          <RevealSection delay={0.2} className="mt-8 flex justify-center md:justify-start">
            <a
              href="https://github.com/Lancerhawk/MailBot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium text-white transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" /></svg>
              View on GitHub
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </RevealSection>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
         SECTION 6 — CTA
         ══════════════════════════════════════════════════════ */}
      <section className="relative z-10 w-full py-28 px-4 sm:px-6">
        <RevealSection>
          <div className="max-w-4xl mx-auto relative rounded-3xl overflow-hidden">
            {/* Gradient border glow */}
            <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 animate-gradient-shift opacity-60" />

            <div className="relative rounded-3xl bg-white dark:bg-[#0a0a14] p-10 sm:p-14">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex flex-col gap-3 md:max-w-md">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white leading-tight">
                    Ready to reclaim your inbox?
                  </h2>
                  <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Connect your Gmail in 30 seconds. No credit card, no setup wizard, no BS. Just smarter email from day one.
                  </p>
                </div>

                <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
                  {user ? (
                    <Link href="/dashboard">
                      <Button
                        size="lg"
                        className="rounded-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg shadow-orange-500/25 h-12 px-8 gap-2.5 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                      >
                        {user.avatarUrl ? (
                          <Image src={user.avatarUrl} alt="Avatar" width={24} height={24} className="h-6 w-6 rounded-full object-cover border border-white/30" unoptimized />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
                            {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                          </div>
                        )}
                        <span>Continue to Dashboard</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      size="lg"
                      onClick={handleGoogleLogin}
                      className="rounded-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg shadow-orange-500/25 h-12 px-8 gap-2.5 font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <svg className="h-5 w-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      Get Started Free
                    </Button>
                  )}
                  <span className="text-xs text-zinc-500 dark:text-zinc-600">Free forever · No credit card required</span>
                </div>
              </div>
            </div>
          </div>
        </RevealSection>
      </section>

      <LandingFooter />
      <ChangelogWidget />
    </div>
  );
}
