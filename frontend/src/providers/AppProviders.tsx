"use client";

import * as React from "react";
import { ThemeProvider } from "./ThemeProvider";
import { AuthProvider } from "./AuthProvider";

import { SocketProvider } from "./SocketProvider";
import { ThreadCacheProvider } from "./ThreadCacheProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
    >
      <AuthProvider>
        <SocketProvider>
          <ThreadCacheProvider>
            {children}
          </ThreadCacheProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
