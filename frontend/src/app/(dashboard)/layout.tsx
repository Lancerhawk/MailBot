import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CommandPalette } from "@/components/common/CommandPalette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <MainLayout>{children}</MainLayout>
      <CommandPalette />
    </ProtectedRoute>
  );
}
