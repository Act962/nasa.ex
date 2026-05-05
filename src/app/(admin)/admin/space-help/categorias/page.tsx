import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import { CategoriesManager } from "@/features/admin/components/space-help/categories-manager";

export default async function AdminSpaceHelpCategoriesPage() {
  await requireAdminSession();
  return <CategoriesManager />;
}
