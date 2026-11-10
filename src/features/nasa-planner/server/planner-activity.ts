import "server-only";
import { logActivity } from "@/features/admin/lib/activity-logger";

/** Registro de "programou / publicou" no log de atividade, igual para a tela e para a IA (spec 0137, RNF-1). */
export async function logScheduleActivity(
  user: { id: string; name: string; email: string; image?: string | null },
  post: { id: string; organizationId: string },
  actionLabel: string,
) {
  await logActivity({
    organizationId: post.organizationId,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userImage: user.image ?? null,
    appSlug: "nasa-planner",
    subAppSlug: "planner-posts",
    featureKey: "planner.post.scheduled",
    action: "planner.post.scheduled",
    actionLabel,
    resourceId: post.id,
  }).catch(() => undefined);
}
