import { requireAdminSession } from "@/lib/admin-utils";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { AdminHeader } from "@/features/admin/components/admin-header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { adminUser } = await requireAdminSession();

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AdminHeader adminUser={adminUser} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
