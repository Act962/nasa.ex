import { create } from "zustand";

interface MessageState {
  token: string | null;
  baseUrl: string | null;
  setInstance: (data: { token: string | null; baseUrl: string | null }) => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  token: null,
  baseUrl: null,
  setInstance: (data) => set({ token: data.token, baseUrl: data.baseUrl }),
}));
