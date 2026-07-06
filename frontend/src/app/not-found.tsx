import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-8 text-center dark:bg-zinc-950">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
        <FileQuestion className="h-10 w-10 text-zinc-500 dark:text-zinc-400" />
      </div>
      <h2 className="mt-6 text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
        404 - Page Not Found
      </h2>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-8">
        <Button asChild>
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
