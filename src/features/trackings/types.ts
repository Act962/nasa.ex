import { Temperature, LeadAction, StatusFlow } from "@/generated/prisma/enums";

export type Lead = {
  order: string;
  id: string;
  trackingId: string;
  isActive: boolean;
  currentAction: LeadAction;
  email: string | null;
  name: string;
  profile: string | null;
  statusId: string;
  createdAt: Date;
  description: string | null;
  phone: string | null;
  responsible: {
    image: string | null;
    name: string;
  } | null;
  leadTags: {
    tag: {
      id: string;
      name: string;
      color: string | null;
      slug: string;
    };
  }[];
  temperature: Temperature;
  statusFlow: StatusFlow;
  slaDeadline?: Date | string | null;
  statusEnteredAt?: Date | string | null;
  // Conversation usada pelo ícone WhatsApp do card pra direcionar pro chat.
  conversation?: { id: string } | null;
  // Formulários do lead — usados pelos ícones de status no card. Estado
  // derivado server-side a partir de jsonResponse + jsonBlock.
  forms?: Array<{
    responseId: string;
    formId: string;
    formName: string;
    createdAt: Date | string;
    state:
      | "empty"
      | "in_progress"
      | "waiting_client_signature"
      | "stale"
      | "complete";
    slug: string;
  }>;
};

