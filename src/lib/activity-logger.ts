import prisma from "./prisma";
export { APP_LABELS, APP_SLUGS } from "./activity-constants";

export interface ActivityData {
  organizationId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userImage?: string | null;
  appSlug: string;
  action: string;
  actionLabel: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export async function logActivity(data: ActivityData): Promise<void> {
  try {
    await prisma.systemActivityLog.create({ data });
  } catch (e) {
    console.error("[activity-logger] failed:", e);
  }
}
