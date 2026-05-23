"use client";

/**
 * "Criar com Planner" trigger — substitui o antigo seletor simples
 * (Planner + tipo de post) pelo PlannerPopup completo com 4 abas
 * (Campanhas, Posts, Mapa Mental, Branding).
 *
 * O nome do export `ActionToPlannerDialog` é mantido pra compat com os
 * call-sites em `card-actions-menu.tsx` e outros lugares que importam
 * pelo nome.
 *
 * NASA Planner 2.0: o popup AGORA carrega o contexto do card (title +
 * description + anexos) e gera automaticamente um post vinculado quando
 * abre. Toda criação de conteúdo (post estático, reel, etc.) acontece
 * dentro do popup, com seleção de modelo de IA visível e brand kit
 * aplicado.
 */

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  PlannerPopup,
  type ActionContext,
} from "@/features/nasa-planner/components/planner-popup";

interface Props {
  actionId: string;
  actionTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActionToPlannerDialog({
  actionId,
  actionTitle,
  open,
  onOpenChange,
}: Props) {
  // Busca o action completo (description + anexos) pra alimentar o popup.
  // `enabled: open` evita prefetch desnecessário quando o dialog está
  // fechado. `staleTime: 30s` evita re-fetch ao abrir/fechar rapidamente.
  const { data: action } = useQuery({
    ...orpc.action.get.queryOptions({ actionId }),
    enabled: open,
    staleTime: 30_000,
  });

  // Extrai URLs dos anexos do action (atualmente armazenados como JSON
  // array em Action.attachments). Schema flexível: aceita strings, URLs,
  // ou objetos com `url`/`href`.
  const attachmentUrls: string[] = (() => {
    if (!action?.attachments) return [];
    const raw = action.attachments as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          if (typeof obj.url === "string") return obj.url;
          if (typeof obj.href === "string") return obj.href;
        }
        return null;
      })
      .filter((s): s is string => !!s);
  })();

  const actionContext: ActionContext = {
    actionId,
    title: actionTitle ?? action?.title ?? "",
    description: action?.description ?? null,
    attachmentUrls,
  };

  return (
    <PlannerPopup
      open={open}
      onOpenChange={onOpenChange}
      actionContext={actionContext}
    />
  );
}
