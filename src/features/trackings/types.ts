import { Temperature, LeadAction, StatusFlow } from "@/generated/prisma/enums";

export type Lead = {
  order: string;
  id: string;
  trackingId: string;
  isActive: boolean;
  currentAction: LeadAction;
  email: string | null;
  name: string;
  nickname?: string | null;
  profile: string | null;
  statusId: string;
  createdAt: Date;
  updatedAt?: Date | string;
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
  /**
   * Prazo mais urgente entre todos os formulários do lead (computado
   * server-side a partir do DatePicker com `useAsDeadline=true`).
   * `null` quando nenhum form tem campo de prazo preenchido.
   */
  deadlineHint?: {
    deadline: string;
    formName: string;
    expired: boolean;
  } | null;
  /**
   * Próximo appointment futuro (PENDING ou CONFIRMED) do lead. Usado pelo
   * ícone de agenda no card do board. `null` quando o lead não tem agenda
   * pendente.
   */
  nextAppointment?: {
    id: string;
    startsAt: string;
    endsAt: string;
    title: string | null;
    meetingType: "ONLINE" | "IN_PERSON";
    agendaName: string;
  } | null;
};

