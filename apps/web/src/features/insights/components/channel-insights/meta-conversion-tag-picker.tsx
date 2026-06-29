"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Check,
  ChevronsUpDown,
  ExternalLink,
  Tag as TagIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Seletor da tag que define "conversão" no drilldown Meta.
 *
 * Quando definida, a coluna "Conv." conta leads com essa tag atribuídos
 * à campanha/conjunto/anúncio. Quando nula, mantém o valor nativo da Meta API.
 *
 * Só owner/admin pode persistir — pra outros papéis o picker fica desabilitado.
 */
export function MetaConversionTagPicker() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: current } = useQuery(
    orpc.metaAds.conversionTag.get.queryOptions({ input: {} }),
  );
  const {
    data: tagsData,
    isLoading: tagsLoading,
    error: tagsError,
  } = useQuery(orpc.tags.listTags.queryOptions({ input: {} }));

  const tags = useMemo(() => tagsData?.tags ?? [], [tagsData]);
  const currentTag = current?.tag ?? null;

  const mutation = useMutation({
    mutationFn: (vars: { tagId: string | null }) =>
      orpc.metaAds.conversionTag.set.call(vars),
    onSuccess: () => {
      toast.success("Tag de conversão atualizada");
      queryClient.invalidateQueries({
        queryKey: orpc.metaAds.conversionTag.get.queryOptions({ input: {} })
          .queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: ["meta", "insightsDrilldown"],
      });
      // Garante refetch de qualquer drilldown
      queryClient.invalidateQueries({ predicate: () => true });
      setOpen(false);
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const handleClear = () => {
    if (!currentTag) return;
    mutation.mutate({ tagId: null });
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        {/* Radix exige que asChild só envolva o Slot final — Tooltip + Popover
            aninhados quebram o click. Padrão recomendado: Tooltip por fora,
            Popover por dentro, ambos passando asChild pro mesmo Button. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-2 text-xs"
                disabled={mutation.isPending}
              >
                <TagIcon className="size-3" />
                {currentTag ? (
                  <>
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: currentTag.color ?? "#1447e6" }}
                    />
                    <span className="max-w-[140px] truncate">
                      {currentTag.name}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Tag de conversão
                  </span>
                )}
                <ChevronsUpDown className="size-3 opacity-50" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Define qual tag de lead conta como "conversão" no drilldown e
            relatórios Meta. Quando aplicada, leads atribuídos à campanha que
            receberem essa tag entram na coluna Conv.
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-[300px] p-0" align="end">
          <Command>
            <CommandInput placeholder="Buscar tag..." />
            <CommandList>
              {tagsLoading ? (
                <div className="p-3 text-xs text-muted-foreground">
                  Carregando tags...
                </div>
              ) : tagsError ? (
                <div className="space-y-2 p-3 text-xs text-destructive">
                  <p className="font-medium">Erro ao carregar tags</p>
                  <p className="text-muted-foreground">
                    {(tagsError as Error).message}
                  </p>
                </div>
              ) : tags.length === 0 ? (
                <div className="space-y-2 p-3 text-xs">
                  <p className="font-medium">
                    Nenhuma tag cadastrada na empresa.
                  </p>
                  <p className="text-muted-foreground">
                    Crie tags na aba de trackings primeiro. Cada tag aplicada
                    nos leads serve pra marcar etapas do funil (ex: "Lead
                    Quente", "Cliente Fechado").
                  </p>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5"
                  >
                    <Link href="/trackings">
                      Ir pra Trackings
                      <ExternalLink className="size-3" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <CommandGroup>
                  {tags.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={`${tag.name} ${tag.slug}`}
                      onSelect={() => mutation.mutate({ tagId: tag.id })}
                      className="gap-2"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color ?? "#1447e6" }}
                      />
                      <span className="flex-1 truncate">{tag.name}</span>
                      <Check
                        className={cn(
                          "size-3.5",
                          currentTag?.id === tag.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {currentTag && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={handleClear}
              disabled={mutation.isPending}
            >
              <X className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Voltar pro cálculo nativo da Meta</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
