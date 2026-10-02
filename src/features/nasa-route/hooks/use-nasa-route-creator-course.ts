"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Curso completo (aulas, módulos, planos) na visão do criador. */
export function useNasaRouteCreatorCourse(courseId: string) {
  return useQuery({
    ...orpc.nasaRoute.creatorGetCourse.queryOptions({ input: { courseId } }),
  });
}

export type NasaRouteCreatorCourse = NonNullable<ReturnType<typeof useNasaRouteCreatorCourse>["data"]>["course"];
