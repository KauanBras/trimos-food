import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { requireSuperAdmin } from "@/lib/platform/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireSuperAdmin();
  const userName =
    profile.full_name?.trim() ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Admin";

  return (
    <div className="flex min-h-screen bg-zinc-100 text-zinc-950">
      <AdminSidebar userName={userName} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
