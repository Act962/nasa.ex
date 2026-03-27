import { ActionPriority } from "@/generated/prisma/enums";
import { Decimal } from "@prisma/client/runtime/client";

export interface Action {
  user: {
    id: string;
    name: string;
    image: string | null;
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
  participants: {
    user: {
      id: string;
      name: string;
      image: string | null;
    };
  }[];
  subActions: {
    id: string;
    isDone: boolean;
  }[];
}
