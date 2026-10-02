import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import { AdminAiCreditsPanel } from "@/features/ai-credits/components/admin-ai-credits-panel";

export default async function AiCreditsPage() {
  await requireAdminSession();
  return <AdminAiCreditsPanel />;
}
