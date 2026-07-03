import { create } from "zustand";
import { Message } from "../types";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";

// Sinais não-sensíveis da instância — o token Uazapi NÃO vive mais no
// front. `instanceId`/`status` servem só de proxy pra "instância
// configurada/conectada" nas condicionais de UI. Credenciais são
// resolvidas server-side (`resolveOutboundProvider`).
interface MessageState {
  instanceId: string | null;
  status: WhatsAppInstanceStatus | null;
  setInstance: (data: {
    instanceId: string | null;
    status: WhatsAppInstanceStatus | null;
  }) => void;

  // Edit Message
  isEditing: boolean;
  messageToEdit: Message | null;
  setIsEditing: (open: boolean) => void;
  setMessageToEdit: (message: Message | null) => void;
  startEditing: (message: Message) => void;
  cancelEditing: () => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  instanceId: null,
  status: null,
  setInstance: (data) =>
    set({ instanceId: data.instanceId, status: data.status }),

  isEditing: false,
  messageToEdit: null,
  setIsEditing: (open) => set({ isEditing: open }),
  setMessageToEdit: (message) => set({ messageToEdit: message }),
  startEditing: (message) => set({ isEditing: true, messageToEdit: message }),
  cancelEditing: () => set({ isEditing: false, messageToEdit: null }),
}));
