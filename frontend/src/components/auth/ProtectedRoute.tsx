"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user && pathname !== "/") {
      router.push("/");
    }
  }, [user, isLoading, router, pathname]);



  if (!user && pathname !== "/") {
    return null;
  }

  return <>{children}</>;
}
