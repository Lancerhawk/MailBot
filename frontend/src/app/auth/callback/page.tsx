"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../../providers/AuthProvider";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshAuth } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const success = searchParams.get("success");
      
      if (success === "true") {
        await refreshAuth();
        router.push("/dashboard");
      } else {
        router.push("/?error=auth_failed");
      }
    };

    handleCallback();
  }, [searchParams, refreshAuth, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 dark:bg-zinc-950">
      <Loader2 className="mb-4 h-12 w-12 animate-spin text-orange-500 dark:text-red-600" />
      <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-50">
        Authenticating...
      </h2>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Please wait while we securely connect your account.
      </p>
    </div>
  );
}
