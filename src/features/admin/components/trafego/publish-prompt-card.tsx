"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCopy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useBuildTrafegoPublishPrompt,
  useSendTrafegoRecommendation,
} from "@/features/trafego/hooks/use-trafego-admin";

/**
 * Publicar pelo Claude (spec 0130, RF-6, RF-7): copia o prompt pronto e devolve ao cliente
 * o bloco "RECOMENDAÇÕES PARA O CLIENTE" para ele aprovar no painel.
 */
export function PublishPromptCard({ orderId, pendingApprovalCount }: { orderId: string; pendingApprovalCount: number }) {
  const buildPrompt = useBuildTrafegoPublishPrompt();
  const sendRecommendation = useSendTrafegoRecommendation();
  const [recommendation, setRecommendation] = useState("");
  const [pendingItems, setPendingItems] = useState<string[]>([]);

  function copyPrompt() {
    buildPrompt.mutate(
      { orderId },
      {
        onSuccess: async (result) => {
          if (!result.ok) {
            toast.error(`Falta ${result.missing.join(" e ")}. Peça ao cliente antes de gerar o prompt.`);
            return;
          }
          await navigator.clipboard.writeText(result.text);
          setPendingItems(result.pending);
          toast.success("Prompt copiado. Cole no Claude.");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function sendForApproval() {
    sendRecommendation.mutate(
      { orderId, recommendation },
      {
        onSuccess: () => {
          setRecommendation("");
          toast.success("Enviado. O cliente vê \"Precisa de aprovação\" no painel.");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Publicar pelo Claude</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Copie o prompt e cole no Claude com o MCP da Meta. Ele monta tudo pausado e termina com as recomendações
          para o cliente. O link do criativo vale 24 h.
        </p>
      </div>
      <Button size="sm" onClick={copyPrompt} disabled={buildPrompt.isPending}>
        <ClipboardCopy className="size-4" />
        Copiar prompt para o Claude
      </Button>
      {pendingItems.length > 0 && (
        <p className="text-xs text-warning">Falta confirmar com o cliente: {pendingItems.join(", ")}.</p>
      )}

      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium">Recomendação do Claude para o cliente aprovar</p>
        <Textarea
          value={recommendation}
          onChange={(event) => setRecommendation(event.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Cole aqui o bloco RECOMENDAÇÕES PARA O CLIENTE"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {pendingApprovalCount > 0 ? "Há uma recomendação esperando o cliente; enviar outra substitui." : ""}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={sendForApproval}
            disabled={recommendation.trim().length < 10 || sendRecommendation.isPending}
          >
            <Send className="size-4" />
            Enviar para aprovação
          </Button>
        </div>
      </div>
    </div>
  );
}
