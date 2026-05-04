import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AppModule, ChartType, DashboardSettings, DateRange } from "../types";
import { ALL_MODULES } from "../types";

interface DashboardState {
  trackingId?: string;
  organizationIds: string[];
  tagIds: string[];
  memberIds: string[];
  dateRange: DateRange;
  settings: DashboardSettings;
  selectedModules: AppModule[];
  moduleOrder: AppModule[];
}

interface DashboardActions {
  setTrackingId: (trackingId: string) => void;
  setDateRange: (dateRange: DateRange) => void;
  setTagIds: (tagIds: string[]) => void;
  setOrganizationIds: (organizationIds: string[]) => void;
  setMemberIds: (memberIds: string[]) => void;
  toggleOrganizationId: (organizationId: string) => void;
  toggleTagId: (tagId: string) => void;
  toggleMemberId: (memberId: string) => void;
  toggleSection: (section: keyof DashboardSettings["visibleSections"]) => void;
  setChartType: (
    chart: keyof DashboardSettings["chartTypes"],
    type: ChartType,
  ) => void;
  resetSettings: () => void;
  setSelectedModules: (modules: AppModule[]) => void;
  setModuleOrder: (order: AppModule[]) => void;
  resetModuleOrder: () => void;
}

const defaultSettings: DashboardSettings = {
  visibleSections: {
    summary: true,
    byStatus: true,
    byChannel: true,
    byAttendant: true,
    topTags: true,
  },
  chartTypes: {
    byStatus: "bar",
    byChannel: "pie",
    byAttendant: "bar",
    topTags: "bar",
  },
};

export const useInsightsStore = create<DashboardState & DashboardActions>()(
  persist(
    (set) => ({
      trackingId: undefined,
      organizationIds: [],
      tagIds: [],
      memberIds: [],
      dateRange: { from: undefined, to: undefined },
      settings: defaultSettings,
      selectedModules: ALL_MODULES,
      moduleOrder: ALL_MODULES,

      setTrackingId: (trackingId) => set({ trackingId }),
      setDateRange: (dateRange) => set({ dateRange }),
      setTagIds: (tagIds) => set({ tagIds }),
      setMemberIds: (memberIds) => set({ memberIds }),
      setOrganizationIds: (organizationIds) =>
        set({ organizationIds, trackingId: undefined }),

      toggleMemberId: (memberId) =>
        set((state) => ({
          memberIds: state.memberIds.includes(memberId)
            ? state.memberIds.filter((id) => id !== memberId)
            : [...state.memberIds, memberId],
        })),

      toggleOrganizationId: (organizationId) => {
        if (organizationId === "ALL") {
          set({ organizationIds: [], trackingId: undefined });
          return;
        }

        set((state) => {
          const newOrganizationIds = state.organizationIds.includes(
            organizationId,
          )
            ? state.organizationIds.filter((id) => id !== organizationId)
            : [...state.organizationIds, organizationId];
          return {
            organizationIds: newOrganizationIds,
            trackingId: undefined,
          };
        });
      },

      toggleTagId: (tagId) =>
        set((state) => ({
          tagIds: state.tagIds.includes(tagId)
            ? state.tagIds.filter((id) => id !== tagId)
            : [...state.tagIds, tagId],
        })),

      toggleSection: (section) =>
        set((state) => ({
          settings: {
            ...state.settings,
            visibleSections: {
              ...state.settings.visibleSections,
              [section]: !state.settings.visibleSections[section],
            },
          },
        })),

      setChartType: (chart, type) =>
        set((state) => ({
          settings: {
            ...state.settings,
            chartTypes: {
              ...state.settings.chartTypes,
              [chart]: type,
            },
          },
        })),

      resetSettings: () => set({ settings: defaultSettings }),

      setSelectedModules: (modules) =>
        set({ selectedModules: modules.length > 0 ? modules : ALL_MODULES }),

      setModuleOrder: (order) =>
        set((state) => {
          // Garante que todos os módulos novos (não persistidos) sejam anexados
          const merged = [
            ...order.filter((m) => ALL_MODULES.includes(m)),
            ...ALL_MODULES.filter((m) => !order.includes(m)),
          ];
          return { moduleOrder: merged };
        }),

      resetModuleOrder: () => set({ moduleOrder: ALL_MODULES }),
    }),
    {
      name: "insights-storage",
      storage: createJSONStorage(() => localStorage),
      // Persistimos as configurações de visualização e os filtros
      partialize: (state) => ({
        settings: state.settings,
        trackingId: state.trackingId,
        organizationIds: state.organizationIds,
        tagIds: state.tagIds,
        memberIds: state.memberIds,
        dateRange: state.dateRange,
        selectedModules: state.selectedModules,
        moduleOrder: state.moduleOrder,
      }),
      onRehydrateStorage: () => (state) => {
        // Converte strings de data de volta para objetos Date após a rehidratação
        if (state?.dateRange) {
          if (state.dateRange.from) {
            state.dateRange.from = new Date(state.dateRange.from);
          }
          if (state.dateRange.to) {
            state.dateRange.to = new Date(state.dateRange.to);
          }
        }
        // Mescla módulos novos que ainda não estão na ordem persistida
        if (state) {
          const persistedOrder = state.moduleOrder ?? [];
          state.moduleOrder = [
            ...persistedOrder.filter((m) => ALL_MODULES.includes(m)),
            ...ALL_MODULES.filter((m) => !persistedOrder.includes(m)),
          ];
        }
      },
    },
  ),
);
