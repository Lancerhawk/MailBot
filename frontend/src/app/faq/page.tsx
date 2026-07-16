import LandingNavbar from "../../components/layout/LandingNavbar";
import LandingFooter from "../../components/layout/LandingFooter";
import { HelpCircle, MessagesSquare, Zap, ShieldCheck } from "lucide-react";

export default function FAQPage() {
  return (
    <div className="relative min-h-screen flex flex-col bg-zinc-50 dark:bg-[#06060c] text-zinc-900 dark:text-zinc-50 transition-colors duration-500 pt-32 selection:bg-orange-500/30">
      <LandingNavbar />
      
      {/* Decorative Background Glows */}
      <div className="absolute top-0 left-0 right-0 h-[50vh] overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[40%] w-[30%] h-[100%] rounded-full bg-orange-500/10 dark:bg-orange-600/10 blur-[120px]" />
      </div>

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 pb-24">
        {/* Page Header */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-500 border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-white">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium">
            Everything you need to know about MailBot.
          </p>
        </div>
        
        {/* Content Container */}
        <div className="space-y-6 relative z-10">
            
          <div className="group rounded-3xl bg-white/60 dark:bg-[#0a0a14]/60 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800/50 shadow-xl p-8 transition-all hover:bg-white dark:hover:bg-[#0c0c16]/80 hover:shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-500 border border-orange-500/20 mt-1">
                <Zap className="w-6 h-6" />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  How does MailBot achieve real-time sync?
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-base">
                  Unlike traditional email clients that poll your inbox every few minutes, MailBot sets up a direct webhook with Google Cloud Pub/Sub. The exact millisecond Google receives an email for you, they push a notification to our servers, allowing us to instantly sync and process the thread.
                </p>
              </div>
            </div>
          </div>

          <div className="group rounded-3xl bg-white/60 dark:bg-[#0a0a14]/60 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800/50 shadow-xl p-8 transition-all hover:bg-white dark:hover:bg-[#0c0c16]/80 hover:shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mt-1">
                <MessagesSquare className="w-6 h-6" />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  What LLM is used for the AI drafts?
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-base">
                  We use Groq&apos;s ultra-fast LPU inference engine running advanced open-source models like Llama 3. This allows us to generate intelligent, context-aware draft responses in a fraction of a second, completely eliminating the waiting time you usually experience with other AI assistants.
                </p>
              </div>
            </div>
          </div>

          <div className="group rounded-3xl bg-white/60 dark:bg-[#0a0a14]/60 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800/50 shadow-xl p-8 transition-all hover:bg-white dark:hover:bg-[#0c0c16]/80 hover:shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/20 mt-1">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Is my data secure and private?
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-base">
                  Absolutely. We encrypt all access tokens using AES-256-GCM. We never use your emails to train our own or third-party AI models, and your data is never sold to advertisers. We strictly adhere to Google&apos;s API Services User Data Policy.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
