import { create } from "zustand";
import { Message } from "../types";

interface MessageState {
  token: string | null;
  baseUrl: string | null;
  setInstance: (data: { token: string | null; baseUrl: string | null }) => void;

  // Edit Message
  isEditing: boolean;
  messageToEdit: Message | null;
  setIsEditing: (open: boolean) => void;
  setMessageToEdit: (message: Message | null) => void;
  startEditing: (message: Message) => void;
  cancelEditing: () => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  token: null,
  baseUrl: null,
  setInstance: (data) => set({ token: data.token, baseUrl: data.baseUrl }),

  isEditing: false,
  messageToEdit: null,
  setIsEditing: (open) => set({ isEditing: open }),
  setMessageToEdit: (message) => set({ messageToEdit: message }),
  startEditing: (message) => set({ isEditing: true, messageToEdit: message }),
  cancelEditing: () => set({ isEditing: false, messageToEdit: null }),
}));
