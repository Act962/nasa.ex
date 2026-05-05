import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import { TracksManager } from "@/features/admin/components/space-help/tracks-manager";

export default async function AdminSpaceHelpTracksPage() {
  await requireAdminSession();
  return <TracksManager />;
}
