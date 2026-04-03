import { requireAdminSession } from "@/lib/admin-utils";
import { PlansManager } from "@/features/admin/components/plans/plans-manager";

export default async function PlansPage() {
  await requireAdminSession();
  return <PlansManager />;
}
