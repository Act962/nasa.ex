import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export type OrgActivityResource = "action" | "workspace" | "organization";

export type OrgActivityAction =
  | `action.${string}`
  | `workspace.${string}`
  | `organization.${string}`;

interface LogOrgActivityInput {
  organizationId: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: OrgActivityAction;
  resource: OrgActivityResource;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function logOrgActivity(input: LogOrgActivityInput) {
  return prisma.orgActivityLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      userName: input.userName,
      userEmail: input.userEmail,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      metadata: input.metadata,
    },
  });
}
