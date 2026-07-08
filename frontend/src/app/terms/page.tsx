import Link from 'next/link';
import LandingNavbar from "../../components/layout/LandingNavbar";
import LandingFooter from "../../components/layout/LandingFooter";
import { FileText, Scale, CheckCircle, AlertTriangle } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="relative min-h-screen flex flex-col bg-zinc-50 dark:bg-[#06060c] text-zinc-900 dark:text-zinc-50 transition-colors duration-500 pt-32 selection:bg-orange-500/30">
      <LandingNavbar />
      
      {/* Decorative Background Glows */}
      <div className="absolute top-0 left-0 right-0 h-[50vh] overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-20%] right-[20%] w-[40%] h-[100%] rounded-full bg-orange-500/10 dark:bg-orange-600/10 blur-[120px]" />
        <div className="absolute top-[10%] left-[10%] w-[30%] h-[80%] rounded-full bg-red-500/10 dark:bg-red-600/10 blur-[100px]" />
      </div>

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 pb-24">
        {/* Page Header */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-500 border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-white">
            Terms of Service
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium">
            The rules of the road. Let's keep things clear and fair.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 border border-zinc-300/50 dark:border-zinc-700/50 text-sm font-medium text-zinc-600 dark:text-zinc-400 mt-4">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>
        
        {/* Content Container */}
        <div className="relative rounded-3xl bg-white/60 dark:bg-[#0a0a14]/60 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800/50 shadow-2xl p-8 md:p-12 overflow-hidden">
          
          <div className="space-y-12 relative z-10">
            
            <section className="group">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 group-hover:bg-orange-500/10 group-hover:text-orange-500 transition-colors">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100">1. Acceptance of Terms</h2>
              </div>
              <div className="pl-14 space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed text-base">
                <p>
                  By accessing or using MailBot, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
                </p>
                <p>
                  MailBot is designed to interface directly with Google's Gmail APIs, and your continued usage implies acceptance of both MailBot's terms and Google's API service policies.
                </p>
              </div>
            </section>

            <div className="h-px w-full bg-zinc-200/80 dark:bg-zinc-800/50" />

            <section className="group">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 group-hover:bg-orange-500/10 group-hover:text-orange-500 transition-colors">
                  <Scale className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100">2. User Responsibilities</h2>
              </div>
              <div className="pl-14 space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed text-base">
                <p>
                  You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. MailBot relies on secure OAuth connections. You must not attempt to reverse engineer, bypass, or exploit any authentication or API mechanism provided by MailBot.
                </p>
              </div>
            </section>

            <div className="h-px w-full bg-zinc-200/80 dark:bg-zinc-800/50" />

            <section className="group">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 group-hover:bg-orange-500/10 group-hover:text-orange-500 transition-colors">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100">3. Limitation of Liability</h2>
              </div>
              <div className="pl-14 space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed text-base">
                <p>
                  MailBot generates automated drafts and insights using third-party Language Models (LLMs). While we strive for accuracy, MailBot is provided "as is" without warranty of any kind.
                </p>
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-red-800 dark:text-red-200 text-sm font-medium">
                  We are not liable for any miscommunications, lost emails, or damages resulting from the use of AI-generated content. Always review drafts before sending.
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
