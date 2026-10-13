"use client";

import { useState } from "react";
import { LayoutTemplateIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useAutomationPermissions } from "@/features/workflows/hooks/use-automation-permissions";
import { useCreateAttendanceTemplate } from "../hooks/use-attendance-template";

// "Criar modelo de atendimento" na página de fluxos do funil (spec 0097): um exemplo pronto de
// atendimento por menu, desligado, para a empresa ver como funciona e trocar os textos.
export function AttendanceTemplateButton({ trackingId }: { trackingId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { canCreate } = useAutomationPermissions();
  const createTemplate = useCreateAttendanceTemplate(trackingId);
  if (!canCreate) return null;

  const handleCreate = () => {
    createTemplate.mutate(
      { trackingId },
      {
        onSuccess: (result) => {
          setIsOpen(false);
          if (result.status === "created") toast.success("Modelo criado, tudo desligado. Troque os textos entre colchetes para poder ligar.");
          else if (result.status === "already_complete") toast.info("Este funil já tem o modelo de atendimento.");
          else toast.info("Este funil já tem um atendimento por menu. O modelo não foi criado.");
        },
        onError: (error) => toast.error(error.message || "Não foi possível criar o modelo."),
      },
    );
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} data-guide={GUIDE_ANCHORS.trackingFlowsAttendanceTemplate.id}>
        <LayoutTemplateIcon className="size-4" />
        <span className="hidden sm:inline">Criar modelo de atendimento</span>
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar modelo de atendimento</DialogTitle>
            <DialogDescription>Um exemplo pronto de atendimento por menu, para você ver como funciona e adaptar.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>1 menu inicial com 3 assuntos</li>
            <li>3 fluxos, um por assunto</li>
            <li>3 menus de perguntas, com respostas de exemplo</li>
          </ul>
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Tudo vem <strong>desligado</strong>. Os textos de exemplo ficam entre colchetes, como &quot;[Escreva aqui o seu endereço]&quot;, e nada liga enquanto você
            não trocar.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={createTemplate.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createTemplate.isPending}>
              {createTemplate.isPending ? "Criando…" : "Criar modelo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
