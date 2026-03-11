"use client";

import { useInsightsStore } from "../context/use-insights";

export function useDashboardStore() {
  const state = useInsightsStore();
  
  return {
    ...state,
  };
}

export function useDashboardFilters() {
  const {
    trackingId,
    organizationIds,
    tagIds,
    dateRange,
    setTrackingId,
    setOrganizationIds,
    toggleOrganizationId,
    setTagIds,
    toggleTagId,
    setDateRange,
  } = useDashboardStore();
  
  return {
    trackingId,
    organizationIds,
    tagIds,
    dateRange,
    setTrackingId,
    setOrganizationIds,
    toggleOrganizationId,
    setTagIds,
    toggleTagId,
    setDateRange,
  };
}

export function useDashboardSettings() {
  const { settings, toggleSection, setChartType, resetSettings } =
    useDashboardStore();
    
  return { settings, toggleSection, setChartType, resetSettings };
}

