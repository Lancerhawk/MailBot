"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import api from "../lib/api";

interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  hasGmailAccess?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/auth/me");
      if (res.data?.data?.user) {
        setUser(res.data.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUser();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchUser]);

  const logout = async () => {
    try {
      setIsLoading(true);
      await api.post("/auth/logout");
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, logout, refreshAuth: fetchUser, setLoading: setIsLoading }}>
      {children}
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-50/80 backdrop-blur-sm dark:bg-zinc-950/80 transition-all duration-300">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500 dark:text-red-600" />
        </div>
      )}
      
      {user && user.hasGmailAccess === false && !isLoading && (
        <div className="fixed bottom-4 right-4 z-[999] w-80 rounded-xl border border-red-200 bg-white p-5 shadow-xl dark:border-red-900/50 dark:bg-zinc-900 animate-slide-in-right">
          <h3 className="mb-2 text-base font-semibold text-red-600 dark:text-red-400">
            Permission Required
          </h3>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            MailBot requires Gmail read/write access to sync your emails. The connection exists, but permissions are missing.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
                window.location.href = `${apiUrl}/auth/google`;
              }}
              className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 cursor-pointer"
            >
              Log in & Grant Permissions
            </button>
            <button
              onClick={logout}
              className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
