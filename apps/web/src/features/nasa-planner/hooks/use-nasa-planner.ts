"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSpacePointCtx } from "@/features/space-point/components/space-point-provider";

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
  const { earn } = useSpacePointCtx();
  return useMutation(
    orpc.nasaPlanner.planners.create.mutationOptions({
      onSuccess: () => {
        toast.success("Planner criado com sucesso!");
        qc.invalidateQueries(orpc.nasaPlanner.planners.list.queryOptions({}));
        earn("create_mindmap", "Novo planner criado 🗓️");
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
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
      },
      onError: () => toast.error("Erro ao excluir post"),
    }),
  );
}

export function useGeneratePlannerPost() {
  const qc = useQueryClient();
  const { earn } = useSpacePointCtx();
  return useMutation(
    orpc.nasaPlanner.posts.generate.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `Post gerado! ${data.starsSpent} stars usadas. Saldo: ${data.balanceAfter}`,
        );
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
        earn("create_post", "Post gerado com IA ✨");
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
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
      },
      onError: () => toast.error("Erro ao aprovar post"),
    }),
  );
}

export function useSchedulePlannerPost() {
  const qc = useQueryClient();
  const { earn } = useSpacePointCtx();
  return useMutation(
    orpc.nasaPlanner.posts.schedule.mutationOptions({
      onSuccess: () => {
        toast.success("Post agendado!");
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
        earn("post_published", "Post agendado com sucesso 🕒");
      },
      onError: (err: any) =>
        toast.error(err?.message ?? "Erro ao agendar post"),
    }),
  );
}

export function usePublishPlannerPost() {
  const qc = useQueryClient();
  const { earn } = useSpacePointCtx();
  return useMutation(
    orpc.nasaPlanner.posts.publish.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Post publicado! ${data.balanceAfter} stars restantes`);
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
        earn("post_published", "Post publicado no Planner 🚀");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao publicar post"),
    }),
  );
}

export function useSyncPostMetrics() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.syncMetrics.mutationOptions({
      onSuccess: () => {
        toast.success("Métricas sincronizadas");
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao sincronizar métricas"),
    }),
  );
}

export function useGeneratePlannerPostImage() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.generateImage.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Imagem gerada! ${data.starsSpent} star${data.starsSpent !== 1 ? "s" : ""} usada${data.starsSpent !== 1 ? "s" : ""}`);
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao gerar imagem"),
    }),
  );
}

export function useUploadPlannerPostImage() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.uploadImage.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
      },
      onError: () => toast.error("Erro ao fazer upload da imagem"),
    }),
  );
}

export function useUpdatePlannerPostSlide() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.updateSlide.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
      },
      onError: () => toast.error("Erro ao salvar slide"),
    }),
  );
}

export function useAttachVideo() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.attachVideo.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
      },
      onError: () => toast.error("Erro ao anexar vídeo"),
    }),
  );
}

export function useAddVideoClip() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.addVideoClip.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
      },
      onError: () => toast.error("Erro ao adicionar clipe"),
    }),
  );
}

export function useSaveEditedVideo() {
  const qc = useQueryClient();
  const { earn } = useSpacePointCtx();
  return useMutation(
    orpc.nasaPlanner.posts.saveEditedVideo.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Vídeo salvo! ${data.starsSpent} star${data.starsSpent !== 1 ? "s" : ""} usada${data.starsSpent !== 1 ? "s" : ""}`);
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
        earn("create_post", "Vídeo editado no Planner 🎬");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao salvar vídeo editado"),
    }),
  );
}

export function useSchedulePlannerPostReal() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.scheduleReal.mutationOptions({
      onSuccess: () => {
        toast.success("Post agendado para publicação!");
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao agendar post"),
    }),
  );
}

export function useGenerateImageFromReference() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.generateImageFromReference.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Imagem gerada! ${data.starsSpent} star usada.`);
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao gerar imagem por referência"),
    }),
  );
}

export function useAddSlidesBatch() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.addSlidesBatch.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
      },
      onError: () => toast.error("Erro ao adicionar slides"),
    }),
  );
}

export function useRemovePostSlide() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.removeSlide.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
      },
      onError: () => toast.error("Erro ao remover slide"),
    }),
  );
}

export function useRemovePostMedia() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.posts.removeMedia.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
      },
      onError: () => toast.error("Erro ao remover mídia"),
    }),
  );
}

export function useTranscribeVideo() {
  return useMutation(
    orpc.nasaPlanner.posts.transcribeVideo.mutationOptions({
      onError: (err: any) => toast.error(err?.message ?? "Erro ao transcrever vídeo"),
    }),
  );
}

export function useGenerateVideoClip() {
  const qc = useQueryClient();
  const { earn } = useSpacePointCtx();
  return useMutation(
    orpc.nasaPlanner.posts.generateVideoClip.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Vídeo gerado! ${data.starsSpent} stars usadas.`);
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
        earn("create_post", "Vídeo gerado com IA 🤖");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao gerar vídeo com IA"),
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
