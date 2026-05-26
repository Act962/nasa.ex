"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyIcon, RadioIcon, AlertTriangleIcon } from "lucide-react";
import { toast } from "sonner";
import { useOrgRole } from "@/hooks/use-org-role";
import { cn } from "@/lib/utils";
import { useInChatStatusRealtime } from "../hooks/use-in-chat-status-realtime";

/**
 * Toggle do modo In-Chat MANUAL (Sprint 3.5).
 *
 * Aparece em `/tracking/[id]/settings` (chat-settings.tsx) abaixo da
 * conexão WhatsApp. Permite que owner/admin/moderador liguem o canal
 * In-Chat como 2º canal mesmo com WhatsApp saudável — útil pra:
 *
 *  - Dar opção ao lead de responder pela página pública /whatsapp/[slug]
 *  - Avisar o time via banner+badge no /tracking-chat ("In-Chat ON")
 *  - Não muda comportamento de envio (uazapi continua + Pusher faz dual)
 *
 * Permissão: defense in depth via role check no client (Switch disabled)
 * + procedure server-side (FORBIDDEN se member/viewer).
 */
export function InChatManualToggle({
  trackingId,
}: {
  trackingId: string;
}) {
  const qc = useQueryClient();
  const { isMaster, isAdmin, isModerador } = useOrgRole();
  const canToggle = isMaster || isAdmin || isModerador;

  // Push-based — Pusher invalida quando status muda. Zero polling.
  useInChatStatusRealtime(trackingId);

  const { data: status, isLoading } = useQuery({
    ...orpc.conversation.getInChatStatus.queryOptions({
      input: { trackingId },
    }),
    // placeholderData mantém o último data durante refetch — sem isso,
    // qualquer refresh causaria flicker. staleTime alto pra evitar
    // refetch em re-render.
    placeholderData: (prev) => prev,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation(
    orpc.integrations.toggleInChatManual.mutationOptions({
      onSuccess: (res: any) => {
        qc.invalidateQueries({
          queryKey: orpc.conversation.getInChatStatus.queryOptions({
            input: { trackingId },
          }).queryKey,
        });
        if (res.changed) {
          toast.success(
            res.manualEnabled
              ? "In-Chat manual ativado"
              : "In-Chat manual desativado",
          );
        }
      },
      onError: (e: any) =>
        toast.error(e?.message ?? "Falha ao atualizar In-Chat"),
    }),
  );

  const inChatUrl =
    status?.orgSlug && typeof window !== "undefined"
      ? `${window.location.origin}/whatsapp/${status.orgSlug}`
      : null;

  const handleCopy = async () => {
    if (!inChatUrl) return;
    try {
      await navigator.clipboard.writeText(inChatUrl);
      toast.success("URL copiada");
    } catch {
      toast.error("Copia manual: " + inChatUrl);
    }
  };

  const isEnabled = status?.manualEnabled ?? false;
  const autoActive = status?.source === "auto" || status?.source === "both";
  // Estado de "sem instância" vira mensagem dentro do card, não early
  // return — evita flicker durante refetch de background.
  const hasInstance = !!status?.instanceId;
  const showSkeletonState = isLoading && !status;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RadioIcon className="size-4 text-violet-500" />
          In-Chat como 2º canal
        </CardTitle>
        <CardDescription>
          Promove a página pública{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            /whatsapp/{status?.orgSlug ?? "..."}
          </code>{" "}
          como canal alternativo ao WhatsApp. Lead escolhe onde responder;
          mensagens sincronizam automaticamente entre os 2 canais. WhatsApp
          continua funcionando normalmente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showSkeletonState ? (
          <div className="flex items-center justify-between gap-4 animate-pulse">
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted/60 rounded" />
            </div>
            <div className="h-5 w-9 bg-muted rounded-full" />
          </div>
        ) : !hasInstance ? (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Ativar modo In-Chat
              </Label>
              <p className="text-xs text-muted-foreground">
                Configure uma instância WhatsApp primeiro pra ligar o
                In-Chat como 2º canal.
              </p>
            </div>
            <Switch disabled checked={false} />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label
                htmlFor="in-chat-manual-toggle"
                className={cn(
                  "text-sm font-medium",
                  !canToggle && "text-muted-foreground",
                )}
              >
                Ativar modo In-Chat
              </Label>
              <p className="text-xs text-muted-foreground">
                {canToggle
                  ? "Banner azul aparece no /tracking-chat avisando o time."
                  : "Apenas owner, admin ou moderador podem ativar."}
              </p>
            </div>
            <Switch
              id="in-chat-manual-toggle"
              checked={isEnabled}
              disabled={!canToggle || mutation.isPending}
              onCheckedChange={(checked) => {
                if (!status?.instanceId) return;
                mutation.mutate({
                  instanceId: status.instanceId,
                  enabled: checked,
                });
              }}
            />
          </div>
        )}

        {isEnabled && status?.manualSetBy && status?.manualSetAt && (
          <p className="text-xs text-muted-foreground">
            Ativado por <span className="font-medium">{status.manualSetBy.name}</span>{" "}
            em{" "}
            {new Date(status.manualSetAt).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        )}

        {autoActive && (
          <Alert variant="destructive" className="border-amber-300/40 bg-amber-50 dark:bg-amber-950/40">
            <AlertTriangleIcon className="size-4" />
            <AlertTitle className="text-amber-900 dark:text-amber-200">
              WhatsApp em modo automático
            </AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              A instância foi detectada como banida/offline. Mensagens
              outbound estão sendo entregues SÓ pelo In-Chat
              automaticamente até a uazapi voltar.
            </AlertDescription>
          </Alert>
        )}

        {inChatUrl && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border">
            <code className="text-xs flex-1 truncate">{inChatUrl}</code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="shrink-0"
            >
              <CopyIcon className="size-3.5" />
              Copiar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
