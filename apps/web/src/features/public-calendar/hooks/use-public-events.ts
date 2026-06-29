"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useFiltersStore } from "../store/filters-store";

export function usePublicEvents(initialData?: Record<string, unknown>) {
  const country = useFiltersStore((s) => s.country);
  const state = useFiltersStore((s) => s.state);
  const city = useFiltersStore((s) => s.city);
  const category = useFiltersStore((s) => s.category);
  const organizationId = useFiltersStore((s) => s.organizationId);
  const search = useFiltersStore((s) => s.search);
  const from = useFiltersStore((s) => s.from);
  const to = useFiltersStore((s) => s.to);

  const hasFilters = !!(
    country ||
    state ||
    city ||
    category ||
    organizationId ||
    search ||
    from ||
    to
  );

  return useQuery({
    ...orpc.public.calendar.listPublic.queryOptions({
      input: {
        country: country ?? undefined,
        state: state ?? undefined,
        city: city ?? undefined,
        category: category ?? undefined,
        organizationId: organizationId ?? undefined,
        search: search || undefined,
        from: from ?? undefined,
        to: to ?? undefined,
        limit: 60,
      },
    }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled: hasFilters || !initialData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialData: !hasFilters ? (initialData as any) : undefined,
  });
}

export function usePublicCategories() {
  return useQuery({
    ...orpc.public.calendar.listCategories.queryOptions({ input: {} }),
    staleTime: 60_000,
  });
}

export function usePublicLocations() {
  return useQuery({
    ...orpc.public.calendar.listLocations.queryOptions({ input: {} }),
    staleTime: 60_000,
  });
}

export function usePublicOrganizations() {
  return useQuery({
    ...orpc.public.calendar.listOrganizations.queryOptions({ input: {} }),
    staleTime: 60_000,
  });
}
