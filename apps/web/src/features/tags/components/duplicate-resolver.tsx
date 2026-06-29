"use client";

import { useState, useMemo } from "react";
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
  AlertTriangleIcon,
  CheckIcon,
  TagIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { getContrastColor } from "@/utils/get-contrast-color";
import { toast } from "sonner";

/**
 * Dialog pra resolver tags duplicadas manualmente.
 *
 * Por que NÃO auto-merge:
 *  - Tag com automações ativas → deletar quebra workflow em prod
 *  - Tag com leads vinculados → deletar perde anotações
 *
 * UX: usuário vê grupos de duplicatas com cards lado-a-lado, escolhe
 * o sobrevivente (radio) por grupo, clica "Mesclar" — backend redireciona
 * lead_tags e atualiza node.data dos workflows pra apontar pro sobrevivente.
 */
export function DuplicateResolver({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    ...orpc.tags.getDuplicateTags.queryOptions({ input: undefined }),
    enabled: open,
  });

  // Map: tag name → survivorId escolhido pelo user
  const [survivors, setSurvivors] = useState<Record<string, string>>({});

  // Quando dados chegam, pre-seleciona o "mais valioso" automaticamente
  // (maior leads*10 + automações). User pode trocar se quiser.
  useMemo(() => {
    if (!data?.duplicates) return;
    setSurvivors((prev) => {
      const next = { ...prev };
      for (const group of data.duplicates) {
        if (next[group.name]) continue;
        const sorted = [...group.tags].sort(
          (a, b) =>
            b.automationCount * 10 +
            b.leadCount -
            (a.automationCount * 10 + a.leadCount),
        );
        next[group.name] = sorted[0]?.id ?? "";
      }
      return next;
    });
  }, [data?.duplicates]);

  const merge = useMutation(
    orpc.tags.mergeDuplicateTags.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `Mesclado: ${result.deletedCount} duplicata(s) removida(s), ${result.redirectedLeadTags} vínculo(s) preservado(s)`,
        );
        qc.invalidateQueries({ queryKey: ["tags"] });
        qc.invalidateQueries({
          queryKey: orpc.tags.getDuplicateTags.queryKey({ input: undefined }),
        });
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const handleMergeGroup = (name: string) => {
    const group = data?.duplicates.find((g) => g.name === name);
    if (!group) return;
    const survivorId = survivors[name];
    if (!survivorId) {
      toast.error("Escolha qual versão manter");
      return;
    }
    const victimIds = group.tags
      .filter((t) => t.id !== survivorId)
      .map((t) => t.id);
    if (victimIds.length === 0) return;
    merge.mutate({ survivorId, victimIds });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-amber-500" />
            Resolver tags duplicadas
          </DialogTitle>
          <DialogDescription>
            Estas tags têm o mesmo nome dentro da organização. Escolha qual
            versão manter — as outras serão removidas, mas{" "}
            <b>todos os leads e automações vão ser redirecionados</b> pra
            sobrevivente automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          )}
          {!isLoading && (!data || data.duplicates.length === 0) && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <CheckIcon className="size-8 mx-auto mb-2 text-emerald-500" />
              Nenhuma duplicata encontrada — tudo em ordem!
            </div>
          )}
          {data?.duplicates.map((group) => {
            const survivorId = survivors[group.name];
            return (
              <div
                key={group.name}
                className="border rounded-lg p-3 space-y-2 bg-card"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TagIcon className="size-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{group.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {group.tags.length} duplicatas
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleMergeGroup(group.name)}
                    disabled={merge.isPending || !survivorId}
                  >
                    Mesclar
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {group.tags.map((tag) => {
                    const isSelected = survivorId === tag.id;
                    return (
                      <button
                        type="button"
                        key={tag.id}
                        onClick={() =>
                          setSurvivors((p) => ({ ...p, [group.name]: tag.id }))
                        }
                        className={cn(
                          "border rounded-md p-2.5 text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={cn(
                              "size-4 rounded-full border-2 flex items-center justify-center shrink-0",
                              isSelected
                                ? "border-primary bg-primary"
                                : "border-muted-foreground",
                            )}
                          >
                            {isSelected && (
                              <CheckIcon className="size-3 text-primary-foreground" />
                            )}
                          </div>
                          <Badge
                            style={{
                              backgroundColor: tag.color ?? "#888",
                              color: getContrastColor(tag.color ?? "#888"),
                            }}
                            className="font-medium"
                          >
                            {group.name}
                          </Badge>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <UsersIcon className="size-3" />
                            <span>
                              <b className="text-foreground">{tag.leadCount}</b>{" "}
                              lead(s)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <ZapIcon
                              className={cn(
                                "size-3",
                                tag.automationCount > 0
                                  ? "text-amber-500"
                                  : "",
                              )}
                            />
                            <span>
                              <b
                                className={cn(
                                  tag.automationCount > 0
                                    ? "text-amber-600"
                                    : "text-foreground",
                                )}
                              >
                                {tag.automationCount}
                              </b>{" "}
                              automação(ões)
                            </span>
                          </div>
                          {tag.trackingName && (
                            <div className="text-muted-foreground truncate">
                              Tracking: {tag.trackingName}
                            </div>
                          )}
                          {!tag.trackingName && (
                            <div className="text-muted-foreground italic">
                              Org-wide
                            </div>
                          )}
                          {tag.tagGroupName && (
                            <div className="text-muted-foreground truncate">
                              Grupo: {tag.tagGroupName}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
