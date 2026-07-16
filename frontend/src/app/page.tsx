"use client";

import { useAuth } from "../providers/AuthProvider";
import { Button } from "../components/ui/button";
import { Zap, Sparkles, LayoutDashboard } from "lucide-react";
import LandingNavbar from "../components/layout/LandingNavbar";
import LandingFooter from "../components/layout/LandingFooter";
import ChangelogWidget from "../components/layout/ChangelogWidget";

const AmbientBackground = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-zinc-50 dark:bg-[#06060c] transition-colors duration-500">
      {/* Massive slow-breathing ambient glows */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-600/10 blur-[150px] animate-pulse"
        style={{ animationDuration: '8s' }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-red-600/10 blur-[130px] animate-pulse"
        style={{ animationDuration: '12s' }}
      />
      <div
        className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full bg-orange-500/5 blur-[100px] animate-pulse"
        style={{ animationDuration: '10s' }}
      />

      {/* Modern Developer/AI Dot Grid (Dark Mode) */}
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNikiLz48L3N2Zz4=")`,
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)'
        }}
      />
      {/* Modern Developer/AI Dot Grid (Light Mode) */}
      <div
        className="absolute inset-0 block dark:hidden opacity-50"
        style={{
          backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4xKSIvPjwvc3ZnPg==")`,
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)'
        }}
      />
    </div>
  );
};

export default function LandingPage() {
  const { setLoading } = useAuth();

  const handleGoogleLogin = () => {
    setLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    window.location.href = `${apiUrl}/auth/google`;
  };
  return (
    <div className="relative min-h-screen flex flex-col bg-zinc-50 dark:bg-[#06060c] text-zinc-900 dark:text-zinc-50 overflow-hidden font-sans selection:bg-orange-500/30 transition-colors duration-500">

      {/* Ambient AI Background */}
      <AmbientBackground />

      <LandingNavbar />

      <main className="relative z-10 w-full min-h-[100vh] flex flex-col items-center justify-center px-4 pt-32 pb-12 text-center">

        <div className="max-w-[90vw] md:max-w-5xl mx-auto flex flex-col items-center justify-center gap-1 sm:gap-2">
          <h1 className="text-3xl md:text-4xl lg:text-5xl 2xl:text-6xl leading-[1.1] font-black tracking-tight text-zinc-900 dark:text-white drop-shadow-sm transition-colors text-center">
            Email that respects
          </h1>
          <h1 className="text-3xl md:text-4xl lg:text-5xl 2xl:text-6xl leading-[1.1] font-black tracking-tight bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 dark:from-orange-400 dark:via-orange-500 dark:to-red-500 bg-clip-text text-transparent pb-2 drop-shadow-[0_0_40px_rgba(249,115,22,0.3)] text-center">
            your time.
          </h1>
        </div>

        <p className="mx-auto mt-6 w-[90%] max-w-xl text-base sm:text-lg text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed transition-colors px-4 text-center">
          The next-generation AI email assistant. MailBot leverages Groq LLMs and real-time Pub/Sub synchronization to auto-categorize threads, extract CRM metadata, and draft intelligent replies the millisecond an email arrives.
        </p>

        {/* Action Buttons */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" onClick={handleGoogleLogin} className="rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white shadow-[0_0_25px_-5px_rgba(88,101,242,0.4)] h-12 px-8 gap-3 font-semibold transition-all hover:scale-105 active:scale-95">
            <svg className="h-5 w-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>
        </div>

        {/* Features Row */}
        <div className="mt-16 md:mt-20 flex flex-row flex-wrap items-center justify-center gap-8 sm:gap-16 px-4">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[clamp(1.25rem,4vw,1.75rem)] font-bold text-zinc-900 dark:text-white tracking-tight text-center">Smart Drafts</span>
            <span className="text-[clamp(0.6rem,1.5vw,0.6875rem)] font-bold tracking-[0.2em] text-zinc-500 uppercase text-center">Context Aware AI</span>
          </div>

          <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800/80 hidden sm:block" />

          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[clamp(1.25rem,4vw,1.75rem)] font-bold text-zinc-900 dark:text-white tracking-tight text-center">Auto CRM</span>
            <span className="text-[clamp(0.6rem,1.5vw,0.6875rem)] font-bold tracking-[0.2em] text-zinc-500 uppercase text-center">Contact Extraction</span>
          </div>

          <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800/80 hidden sm:block" />

          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[clamp(1.25rem,4vw,1.75rem)] font-bold text-zinc-900 dark:text-white tracking-tight text-center">Live Sync</span>
            <span className="text-[clamp(0.6rem,1.5vw,0.6875rem)] font-bold tracking-[0.2em] text-zinc-500 uppercase text-center">Real-Time Updates</span>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="relative z-10 w-full bg-white/40 dark:bg-[#0a0a14]/40 border-t border-zinc-200 dark:border-zinc-900 backdrop-blur-sm py-32 px-4 text-center transition-colors">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-[clamp(1.75rem,5vw,2.25rem)] font-bold tracking-tight text-zinc-900 dark:text-white mb-4 text-center px-4">
            Everything you need for a <span className="text-orange-500">cleaner inbox</span>.
          </h2>
          <p className="text-[clamp(0.875rem,2vw,1rem)] text-zinc-600 dark:text-zinc-400 mb-20 max-w-2xl mx-auto text-center px-4">
            MailBot uses cutting-edge artificial intelligence to transform the way you handle emails.
            Automate the boring stuff and focus on what actually matters.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-[#06060c]/80 shadow-[0_0_30px_rgba(0,0,0,0.05)] dark:shadow-[0_0_30px_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-2">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-500 border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                <Zap className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-[clamp(1.125rem,2.5vw,1.25rem)] font-bold text-zinc-900 dark:text-zinc-100">Real-Time Sync</h3>
              <p className="text-[clamp(0.75rem,2vw,0.875rem)] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Direct integration with Google Cloud Pub/Sub webhooks ensures your inbox state is updated instantly the millisecond an email arrives.
              </p>
            </div>

            <div className="flex flex-col items-center p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-[#06060c]/80 shadow-[0_0_30px_rgba(0,0,0,0.05)] dark:shadow-[0_0_30px_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-2">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-500 border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-[clamp(1.125rem,2.5vw,1.25rem)] font-bold text-zinc-900 dark:text-zinc-100">AI-Assisted Drafting</h3>
              <p className="text-[clamp(0.75rem,2vw,0.875rem)] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Leverages lightning-fast Groq LLMs to deeply analyze incoming threads and automatically propose context-aware, ready-to-send draft replies.
              </p>
            </div>

            <div className="flex flex-col items-center p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-[#06060c]/80 shadow-[0_0_30px_rgba(0,0,0,0.05)] dark:shadow-[0_0_30px_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-2">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-500 border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                <LayoutDashboard className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-[clamp(1.125rem,2.5vw,1.25rem)] font-bold text-zinc-900 dark:text-zinc-100">Automated CRM</h3>
              <p className="text-[clamp(0.75rem,2vw,0.875rem)] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Passively builds a directory of contacts and organizations by extracting sender data and interaction history from every single email you receive.
              </p>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
      <ChangelogWidget />
    </div>
  );
}
