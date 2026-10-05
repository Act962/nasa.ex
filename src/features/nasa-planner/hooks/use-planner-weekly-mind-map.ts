"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { orpc } from "@/lib/orpc";
import { WEEKLY_TEMPLATE, buildWeeklyMap, weekLabel } from "../lib/mind-map/weekly-map";

/** "Planejar a semana" (spec 0068): cria um mapa mental já montado com os dias, os temas e os posts da semana. */
export function useCreateWeeklyMindMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { plannerId: string; organizationId: string; weekMonday: Date }) => {
      const [calendar, weekdayThemes] = await Promise.all([
        queryClient.fetchQuery(orpc.nasaPlanner.calendar.posts.queryOptions({ input: { organizationIds: [input.organizationId], from: input.weekMonday, to: addDays(input.weekMonday, 7) } })),
        queryClient.fetchQuery(orpc.nasaPlanner.planning.listWeekdayThemes.queryOptions({ input: { organizationIds: [input.organizationId] } })),
      ]);
      const weeklyMap = buildWeeklyMap({
        weekMonday: input.weekMonday,
        organizationId: input.organizationId,
        posts: calendar.posts,
        themes: weekdayThemes.themes.filter((theme) => theme.organizationId === input.organizationId),
      });
      return orpc.nasaPlanner.mindMaps.create.call({
        plannerId: input.plannerId,
        name: weekLabel(input.weekMonday),
        template: WEEKLY_TEMPLATE,
        nodes: weeklyMap.nodes as unknown as Array<Record<string, unknown>>,
        edges: weeklyMap.edges as unknown as Array<Record<string, unknown>>,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.mindMaps.key() }),
  });
}
