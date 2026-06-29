// ─── Tag arquivada (aba "Arquivadas") ────────────────────────────────────────
// Renderiza badge translúcido + ações "Restaurar" (zera archivedAt) e
// "Excluir permanente" (chama tag.purge — hard delete irreversível).

import { useState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePurgeTag, useRestoreTag } from "@/features/tags/hooks/use-tags";
import { getContrastColor } from "@/utils/get-contrast-color";
import type { ArchivedTagItemProps } from "./types";

export function ArchivedTagItem(tag: ArchivedTagItemProps) {
  const [confirmPurge, setConfirmPurge] = useState(false);
  const restoreTag = useRestoreTag();
  const purgeTag = usePurgeTag();
  const automationCount = tag.automationCount ?? 0;

  const handleRestore = () => {
    restoreTag.mutate({
      tagId: tag.id,
      name: tag.name,
      color: tag.color,
      restore: true,
    });
  };

  const handlePurge = () => {
    purgeTag.mutate(
      { tagId: tag.id },
      { onSuccess: () => setConfirmPurge(false) },
    );
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Badge
            style={{
              backgroundColor: tag.color,
              color: getContrastColor(tag.color),
            }}
            className="cursor-pointer focus-visible:ring-0 outline-none gap-1 opacity-50 line-through"
            title="Tag arquivada — clique pra restaurar ou excluir permanente"
          >
            <ArchiveIcon className="size-3" />
            {tag.name}
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-2 space-y-2">
          <div className="text-xs space-y-1">
            <p className="font-medium">{tag.name}</p>
            <p className="text-muted-foreground text-[11px]">
              Tag arquivada — histórico preservado em Jornada, Insights e
              /contatos.
            </p>
            {automationCount > 0 && (
              <p className="text-amber-600 text-[11px] inline-flex items-center gap-1">
                <ZapIcon className="size-3" />
                {automationCount} automação(ões) ainda referenciam
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRestore}
              disabled={restoreTag.isPending}
              className="flex-1"
            >
              <ArchiveRestoreIcon className="size-3.5" />
              Restaurar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmPurge(true)}
              className="flex-1"
              title="Hard delete — irreversível"
            >
              <Trash2Icon className="size-3.5" />
              Excluir
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={confirmPurge} onOpenChange={setConfirmPurge}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Excluir permanentemente &ldquo;{tag.name}&rdquo;?
            </DialogTitle>
            <DialogDescription>
              <b>Esta ação não pode ser desfeita.</b> A tag e todos os
              vínculos com leads serão apagados do banco. A Jornada do lead
              ainda mostrará o evento histórico (com nome/cor capturados no
              momento da operação), mas o link clicável vai sumir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPurge(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handlePurge}
              disabled={purgeTag.isPending}
            >
              {purgeTag.isPending
                ? "Excluindo..."
                : "Sim, excluir permanentemente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
