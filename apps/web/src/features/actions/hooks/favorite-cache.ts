"use client";

import type { QueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

type Patch = Partial<{ isFavorited: boolean; isFavoritedByMe: boolean }>;

/**
 * Walks every cached query that may contain the given action and applies the
 * patch in-place. Covers:
 *  - orpc-keyed queries (action.get, listByColumn, listByWorkspace, listFavorites)
 *  - custom-keyed queries that start with "action.listByColumn" (infinite kanban)
 *  - infinite-query shapes (data.pages[].action / .actions / .items)
 *
 * Independent of which key format a consumer used, so toggling a favorite
 * always reflects in the UI before the refetch lands.
 */
export function patchActionFavoriteInCaches(
  qc: QueryClient,
  actionId: string,
  patch: Patch,
) {
  qc.setQueriesData<any>({ predicate: () => true }, (data: any) => {
    if (!data || typeof data !== "object") return data;

    // action.get → { action: {...}, hasAccess }
    if ("action" in data && data.action && (data.action as any).id === actionId) {
      return { ...data, action: { ...data.action, ...patch } };
    }

    // listByWorkspace → { actions: [...] }
    if (Array.isArray(data.actions)) {
      let changed = false;
      const next = data.actions.map((a: any) => {
        if (a?.id === actionId) {
          changed = true;
          return { ...a, ...patch };
        }
        return a;
      });
      if (changed) return { ...data, actions: next };
    }

    // listFavorites → { items: [...] }
    if (Array.isArray(data.items)) {
      let changed = false;
      const next = data.items.map((a: any) => {
        if (a?.id === actionId) {
          changed = true;
          return { ...a, ...patch };
        }
        return a;
      });
      if (changed) return { ...data, items: next };
    }

    // listByColumn (single page) → { action: [...] }
    if (Array.isArray(data.action)) {
      let changed = false;
      const next = data.action.map((a: any) => {
        if (a?.id === actionId) {
          changed = true;
          return { ...a, ...patch };
        }
        return a;
      });
      if (changed) return { ...data, action: next };
    }

    // Infinite query → { pages: [{ action: [...] | items: [...] | actions: [...] }, ...] }
    if (Array.isArray(data.pages)) {
      let outerChanged = false;
      const nextPages = data.pages.map((page: any) => {
        if (!page || typeof page !== "object") return page;
        const updated = { ...page };
        let pageChanged = false;
        for (const key of ["action", "actions", "items"] as const) {
          if (Array.isArray(page[key])) {
            const arr = page[key].map((a: any) => {
              if (a?.id === actionId) {
                pageChanged = true;
                return { ...a, ...patch };
              }
              return a;
            });
            if (pageChanged) updated[key] = arr;
          }
        }
        if (pageChanged) outerChanged = true;
        return pageChanged ? updated : page;
      });
      if (outerChanged) return { ...data, pages: nextPages };
    }

    return data;
  });
}

/**
 * Fires a wide invalidation across every key shape in use for action queries.
 * Both orpc-canonical keys and the custom string prefixes used by the
 * infinite kanban are covered.
 */
export function invalidateActionQueries(
  qc: QueryClient,
  workspaceId?: string,
) {
  // orpc canonical keys
  qc.invalidateQueries({ queryKey: orpc.action.get.key() });
  qc.invalidateQueries({ queryKey: orpc.action.listByColumn.key() });
  qc.invalidateQueries({ queryKey: orpc.action.listByWorkspace.key() });
  qc.invalidateQueries({ queryKey: orpc.action.listFavorites.key() });

  // String-prefix keys used by infinite kanban (see useInfiniteActionsByStatus)
  qc.invalidateQueries({ queryKey: ["action.listByColumn"] });
  qc.invalidateQueries({ queryKey: ["action.listByWorkspace"] });
  qc.invalidateQueries({ queryKey: ["action.get"] });
  qc.invalidateQueries({ queryKey: ["action.listFavorites"] });

  if (workspaceId) {
    qc.invalidateQueries(
      orpc.action.listFavorites.queryOptions({
        input: { workspaceId, limit: 100 },
      }),
    );
  }
}
