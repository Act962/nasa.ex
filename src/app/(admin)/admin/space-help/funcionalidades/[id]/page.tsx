import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import { FeatureStepsEditor } from "@/features/admin/components/space-help/feature-steps-editor";

export default async function AdminSpaceHelpFeatureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  return <FeatureStepsEditor featureId={id} />;
}
