import type { TagType } from "@/generated/prisma/enums";

export interface TagItemProps {
  color: string;
  type: TagType;
  name: string;
  id: string;
  slug: string;
  description: string | null;
  icon: string | null;
  whatsappId: string | null;
  automationCount?: number;
  leadCount?: number;
  tagGroupId?: string | null;
  isArchived?: boolean;
}

export interface ArchivedTagItemProps extends TagItemProps {
  isArchived?: boolean;
}
