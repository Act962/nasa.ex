import { ActionPriority } from "@/generated/prisma/enums";
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
}
