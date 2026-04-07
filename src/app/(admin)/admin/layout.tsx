import { requireAdminSession } from "@/lib/admin-utils";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { AdminHeader } from "@/features/admin/components/admin-header";
import { AdminLayoutClient } from "@/features/admin/components/admin-layout-client";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { adminUser } = await requireAdminSession();

  return (
    <AdminLayoutClient adminUser={adminUser}>
      {children}
    </AdminLayoutClient>
  );
}
