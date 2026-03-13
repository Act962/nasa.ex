import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChartType, DashboardSettings, DateRange } from "../types";

interface DashboardState {
  trackingId?: string;
  organizationIds: string[];
  tagIds: string[];
  dateRange: DateRange;
  settings: DashboardSettings;
}

interface DashboardActions {
  setTrackingId: (trackingId: string) => void;
  setDateRange: (dateRange: DateRange) => void;
  setTagIds: (tagIds: string[]) => void;
  setOrganizationIds: (organizationIds: string[]) => void;
  toggleOrganizationId: (organizationId: string) => void;
  toggleTagId: (tagId: string) => void;
  toggleSection: (section: keyof DashboardSettings["visibleSections"]) => void;
  setChartType: (
    chart: keyof DashboardSettings["chartTypes"],
    type: ChartType,
  ) => void;
  resetSettings: () => void;
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
      dateRange: { from: undefined, to: undefined },
      settings: defaultSettings,

      setTrackingId: (trackingId) => set({ trackingId }),
      setDateRange: (dateRange) => set({ dateRange }),
      setTagIds: (tagIds) => set({ tagIds }),
      setOrganizationIds: (organizationIds) =>
        set({ organizationIds, trackingId: undefined }),

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
        dateRange: state.dateRange,
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
      },
    },
  ),
);
