"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export const SIDEBAR_PREFS_KEY = ["sidebar-prefs"] as const;

export function useSidebarPrefs() {
  return useQuery({
    queryKey: SIDEBAR_PREFS_KEY,
    queryFn: () => orpc.sidebarPrefs.get.call({}),
    staleTime: 5 * 60_000,
  });
}

export function useSetSidebarPref() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { itemKey: string; visible: boolean }) =>
      orpc.sidebarPrefs.set.call(vars),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: SIDEBAR_PREFS_KEY });
      const prev = qc.getQueryData<Record<string, boolean>>(SIDEBAR_PREFS_KEY);
      qc.setQueryData<Record<string, boolean>>(SIDEBAR_PREFS_KEY, (old) => ({
        ...(old ?? {}),
        [vars.itemKey]: vars.visible,
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(SIDEBAR_PREFS_KEY, ctx?.prev);
    },
    onSuccess: (_data, vars) => {
      // Confirm the optimistic value with the server-approved state
      qc.setQueryData<Record<string, boolean>>(SIDEBAR_PREFS_KEY, (old) => ({
        ...(old ?? {}),
        [vars.itemKey]: vars.visible,
      }));
    },
  });
}

/** Returns true if item should be shown. Uses defaultVisible when no pref saved. */
export function isItemVisible(
  prefs: Record<string, boolean> | undefined,
  key: string,
  defaultVisible = true,
): boolean {
  if (!prefs || prefs[key] === undefined) return defaultVisible;
  return prefs[key];
}
