import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import { BadgesManager } from "@/features/admin/components/space-help/badges-manager";

export default async function AdminSpaceHelpBadgesPage() {
  await requireAdminSession();
  return <BadgesManager />;
}
