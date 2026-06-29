import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import { TrackLessonsEditor } from "@/features/admin/components/space-help/track-lessons-editor";

export default async function AdminSpaceHelpTrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  return <TrackLessonsEditor trackId={id} />;
}
