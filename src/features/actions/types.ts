import { ActionPriority } from "@/generated/prisma/enums";
import { Decimal } from "@prisma/client/runtime/client";

export interface ActionTimer {
  id: string;
  actionId: string;
  userId: string;
  startedAt: Date;
  stoppedAt: Date | null;
  duration: number;
  user?: {
    id: string;
    name: string;
    image: string | null;
  };
}


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
    responsibles: {
      user: {
        id: string;
        name: string;
        image: string | null;
      };
    }[];
  }[];

  // Sprint 2 fields
  attachments: { name: string; url: string; type?: string }[];
  links: { title: string; url: string }[];
  youtubeUrl: string | null;
  coverImage: string | null;
  isArchived: boolean;
  isFavorited: boolean;
  history: {
    type: string;
    userId: string;
    timestamp: string;
    changes?: string[];
  }[];
  tags: {
    tag: {
      id: string;
      name: string;
      color: string;
    };
  }[];
  timers: ActionTimer[];
}

