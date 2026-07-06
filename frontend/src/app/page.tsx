"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { Button } from "../components/ui/button";
import { Loader2, Mail, Shield, Zap, Sparkles, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function LandingPage() {
  const { user, isLoading, logout, setLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {

  }, [user, isLoading, router]);

  const handleGoogleLogin = () => {
    setLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    window.location.href = `${apiUrl}/auth/google`;
  };



  return (
    <div className="flex min-h-screen flex-col bg-stone-50 transition-colors duration-300 dark:bg-zinc-950">
      <header className="flex h-16 items-center justify-between border-b border-zinc-200 px-8 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-white dark:bg-red-600">
            <Mail className="h-5 w-5" />
          </div>
          MailBot
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            <span className="sr-only">Toggle theme</span>
            {mounted && theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {user ? (
            <div className="relative">
              <Button
                variant="ghost"
                className="flex items-center p-1.5"
                onClick={() => {
                  const menu = document.getElementById('landing-user-menu');
                  menu?.classList.toggle('hidden');
                }}
              >
                <span className="sr-only">Open user menu</span>
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </div>
                )}
                <span className="hidden sm:flex sm:items-center">
                  <span
                    className="ml-4 text-sm font-semibold leading-6 text-zinc-900 dark:text-zinc-50"
                    aria-hidden="true"
                  >
                    {user.name || user.email || 'User'}
                  </span>
                </span>
              </Button>

              <div id="landing-user-menu" className="absolute right-0 z-10 mt-2.5 hidden w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-zinc-900/5 focus:outline-none dark:bg-zinc-900 dark:ring-zinc-800">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="block w-full px-3 py-1 text-left text-sm leading-6 text-zinc-900 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => logout()}
                  className="block w-full px-3 py-1 text-left text-sm leading-6 text-zinc-900 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <Button onClick={handleGoogleLogin}>
              Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="flex flex-col items-center justify-center px-4 py-32 text-center sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl md:text-6xl dark:text-zinc-50">
              <span className="block">Your AI-Powered</span>
              <span className="block text-orange-500 dark:text-red-600">Email Assistant</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-500 dark:text-zinc-400">
              Take control of your inbox with intelligent summarization, automated drafting, and smart classification. MailBot works seamlessly with your Gmail account.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Button size="lg" onClick={handleGoogleLogin} className="gap-2 text-md h-12 px-8">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>
            </div>
          </div>
        </section>

        <section className="bg-white py-24 transition-colors duration-300 dark:bg-zinc-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-500 dark:bg-red-900/30 dark:text-red-500">
                  <Zap className="h-8 w-8" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">Lightning Fast</h3>
                <p className="text-zinc-500 dark:text-zinc-400">Process hundreds of emails in seconds with our optimized synchronization engine.</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-500 dark:bg-red-900/30 dark:text-red-500">
                  <Shield className="h-8 w-8" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">Secure & Private</h3>
                <p className="text-zinc-500 dark:text-zinc-400">Your tokens are securely encrypted using military-grade AES-256-GCM encryption.</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-500 dark:bg-red-900/30 dark:text-red-500">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">AI Ready</h3>
                <p className="text-zinc-500 dark:text-zinc-400">Built from the ground up to integrate advanced AI models for drafting and summarization.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-8 text-center text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <p>&copy; {new Date().getFullYear()} MailBot. All rights reserved.</p>
      </footer>
    </div>
  );
}
