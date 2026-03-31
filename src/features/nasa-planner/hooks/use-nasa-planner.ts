"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─── Planners ─────────────────────────────────────────────────────────────────

export function useNasaPlanners() {
  const { data, isLoading } = useQuery(
    orpc.nasaPlanner.planners.list.queryOptions({}),
  );
  return { planners: data?.planners ?? [], isLoading };
}

export function useNasaPlanner(plannerId: string) {
  const { data, isLoading } = useQuery(
    orpc.nasaPlanner.planners.get.queryOptions({ input: { plannerId } }),
  );
  return { planner: data?.planner, isLoading };
}

export function useCreatePlanner() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.planners.create.mutationOptions({
      onSuccess: () => {
        toast.success("Planner criado com sucesso!");
        qc.invalidateQueries(orpc.nasaPlanner.planners.list.queryOptions({}));
      },
      onError: () => toast.error("Erro ao criar planner"),
    }),
  );
}

export function useUpdatePlanner() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.planners.update.mutationOptions({
      onSuccess: (data) => {
        toast.success("Planner atualizado!");
        qc.invalidateQueries(orpc.nasaPlanner.planners.list.queryOptions({}));
        qc.invalidateQueries(
          orpc.nasaPlanner.planners.get.queryOptions({
            input: { plannerId: data.planner.id },
          }),
        );
      },
      onError: () => toast.error("Erro ao atualizar planner"),
    }),
  );
}

export function useDeletePlanner() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.planners.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Planner excluído!");
        qc.invalidateQueries(orpc.nasaPlanner.planners.list.queryOptions({}));
      },
      onError: () => toast.error("Erro ao excluir planner"),
    }),
  );
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export function useNasaPlannerPosts(
  plannerId: string,
  params?: { status?: string; search?: string },
) {
  const { data, isLoading } = useQuery(
    orpc.nasaPlanner.posts.getMany.queryOptions({
      input: { plannerId, ...params },
    }),
  );
  return { posts: data?.posts ?? [], isLoading };
}

export function useCreatePlannerPost() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("Post criado!");
        qc.invalidateQueries(
          orpc.nasaPlanner.posts.getMany.queryOptions({
            input: { plannerId: data.post.plannerId },
          }),
        );
      },
      onError: () => toast.error("Erro ao criar post"),
    }),
  );
}

export function useUpdatePlannerPost() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.update.mutationOptions({
      onSuccess: (data) => {
        toast.success("Post atualizado!");
        if (data.post) {
          qc.invalidateQueries(
            orpc.nasaPlanner.posts.getMany.queryOptions({
              input: { plannerId: data.post.plannerId },
            }),
          );
        }
      },
      onError: () => toast.error("Erro ao atualizar post"),
    }),
  );
}

export function useDeletePlannerPost() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Post excluído!");
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts", "getMany"] });
      },
      onError: () => toast.error("Erro ao excluir post"),
    }),
  );
}

export function useGeneratePlannerPost() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.generate.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `Post gerado! ${data.starsSpent} stars usadas. Saldo: ${data.balanceAfter}`,
        );
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts", "getMany"] });
      },
      onError: (err: any) =>
        toast.error(err?.message ?? "Erro ao gerar post com IA"),
    }),
  );
}

export function useApprovePlannerPost() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.approve.mutationOptions({
      onSuccess: () => {
        toast.success("Post aprovado!");
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts", "getMany"] });
      },
      onError: () => toast.error("Erro ao aprovar post"),
    }),
  );
}

export function useSchedulePlannerPost() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.schedule.mutationOptions({
      onSuccess: () => {
        toast.success("Post agendado!");
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts", "getMany"] });
      },
      onError: (err: any) =>
        toast.error(err?.message ?? "Erro ao agendar post"),
    }),
  );
}

// ─── Mind Maps ────────────────────────────────────────────────────────────────

export function useNasaPlannerMindMaps(plannerId: string) {
  const { data, isLoading } = useQuery(
    orpc.nasaPlanner.mindMaps.list.queryOptions({ input: { plannerId } }),
  );
  return { mindMaps: data?.mindMaps ?? [], isLoading };
}

export function useNasaPlannerMindMap(mindMapId: string) {
  const { data, isLoading } = useQuery(
    orpc.nasaPlanner.mindMaps.get.queryOptions({ input: { mindMapId } }),
  );
  return { mindMap: data?.mindMap, isLoading };
}

export function useCreateMindMap() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.mindMaps.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("Mapa mental criado!");
        qc.invalidateQueries(
          orpc.nasaPlanner.mindMaps.list.queryOptions({
            input: { plannerId: data.mindMap.plannerId },
          }),
        );
      },
      onError: () => toast.error("Erro ao criar mapa mental"),
    }),
  );
}

export function useUpdateMindMap() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.mindMaps.update.mutationOptions({
      onSuccess: (data) => {
        qc.invalidateQueries(
          orpc.nasaPlanner.mindMaps.get.queryOptions({
            input: { mindMapId: data.mindMap.id },
          }),
        );
      },
    }),
  );
}

export function useDeleteMindMap() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.mindMaps.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Mapa mental excluído!");
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "mindMaps", "list"] });
      },
      onError: () => toast.error("Erro ao excluir mapa mental"),
    }),
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

export function useNasaPlannerCards(params: {
  mindMapId?: string;
  plannerId?: string;
  status?: string;
}) {
  const { data, isLoading } = useQuery(
    orpc.nasaPlanner.cards.list.queryOptions({ input: params }),
  );
  return { cards: data?.cards ?? [], isLoading };
}

export function useCreateCard() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.cards.create.mutationOptions({
      onSuccess: () => {
        toast.success("Card criado!");
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "cards", "list"] });
      },
      onError: () => toast.error("Erro ao criar card"),
    }),
  );
}

export function useUpdateCard() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.cards.update.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "cards", "list"] });
      },
      onError: () => toast.error("Erro ao atualizar card"),
    }),
  );
}

export function useDeleteCard() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.cards.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Card excluído!");
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "cards", "list"] });
      },
      onError: () => toast.error("Erro ao excluir card"),
    }),
  );
}

// ─── Calendar Share ───────────────────────────────────────────────────────────

export function useCreateCalendarShare() {
  return useMutation(
    orpc.nasaPlanner.calendar.share.mutationOptions({
      onSuccess: () => toast.success("Link de compartilhamento criado!"),
      onError: () => toast.error("Erro ao criar link"),
    }),
  );
}
