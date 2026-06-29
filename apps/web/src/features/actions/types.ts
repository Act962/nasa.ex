import { ActionPriority, EventCategory } from "@/generated/prisma/enums";
import { Decimal } from "@prisma/client/runtime/client";

export interface Action {
  user: {
    id: string;
    name: string;
    image: string | null;
    email?: string;
  };
  id: string;
  createdAt: Date;
  columnId: string | null;
  title: string;
  description: string | null;
  isDone: boolean;
  priority: ActionPriority;
  order: Decimal;
  dueDate: Date | null;
  startDate: Date | null;
  createdBy: string;
  workspaceId: string;
  workspace?: {
    name: string;
  };
  participants: {
    user: {
      id: string;
      name: string;
      image: string | null;
      email?: string;
    };
  }[];
  responsibles: {
    user: {
      id: string;
      name: string;
      image: string | null;
      email?: string;
    };
  }[];
  subActions: {
    id: string;
    title: string;
    isDone: boolean;
    description: string | null;
    finishDate: Date | null;
    order?: number;
    groupId?: string | null;
    responsibles: {
      user: {
        id: string;
        name: string;
        image: string | null;
      };
    }[];
  }[];
  subActionGroups?: {
    id: string;
    name: string;
    order: number;
    isOpen: boolean;
  }[];

  orgProjectId?: string | null;
  orgProject?: {
    id: string;
    name: string;
    color: string | null;
    avatar: string | null;
  } | null;

  // Sprint 2 fields
  attachments: { name: string; url: string; type?: string }[];
  links: { title: string; url: string }[];
  youtubeUrl: string | null;
  coverImage: string | null;
  isArchived: boolean;
  isFavorited: boolean;
  activityLogs: {
    id: string;
    action: string;
    userId: string;
    userName: string;
    userEmail: string;
    resource: string | null;
    resourceId: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt: Date;
  }[];
  tags: {
    tag: {
      id: string;
      name: string;
      color: string;
    };
  }[];

  // ─── Calendário Público ─────────────────────────────────────────────
  isPublic?: boolean;
  publicSlug?: string | null;
  publishedAt?: Date | string | null;
  eventCategory?: EventCategory | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  registrationUrl?: string | null;
  viewCount?: number;
  likesCount?: number;
  shareCount?: number;

  // ─── Compartilhamento cross-org ─────────────────────────────────────
  /** True se a ação é uma cópia recebida de outra empresa. */
  isReceivedCopy?: boolean;
  /** True se o user atual pode compartilhar com outras empresas
   *  (criador OU moderador, e não é cópia recebida). */
  canShareWithOrgs?: boolean;
}

export type ActionHistoryType =
  | "action.created"
  | "action.updated"
  | "action.moved"
  | "action.archived"
  | "action.unarchived"
  | "action.done_changed"
  | "action.checklist_added"
  | "action.checklist_updated";
