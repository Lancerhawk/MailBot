import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers/AppProviders";
import VyzoraProvider from '@/components/common/VyzoraProvider';

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MailBot",
  description: "AI-powered email management platform",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={outfit.variable}>
      <body className="font-sans antialiased">
        <VyzoraProvider />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
