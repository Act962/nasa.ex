import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import { CategoryFeaturesEditor } from "@/features/admin/components/space-help/category-features-editor";

export default async function AdminSpaceHelpCategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  return <CategoryFeaturesEditor categoryId={id} />;
}
