import { Lead } from '@/generated/prisma';
import { create } from 'zustand';

type LeadStore = {
    lead: Lead | null;
    setLead: (lead: Lead ) => void;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
}

export const useLeads = create<LeadStore>((set) => ({
    isOpen: false,
    onOpen: () => set({ isOpen: true }),
    onClose: () => set({ isOpen: false }),
    lead: null,
    setLead: (lead) => set({ lead }),
}))