"use client";

import { useState } from "react";
import { CheckCircle2, Tag as TagIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { orpc } from "@/lib/orpc";
import { useAddTags } from "@/features/trackings/hooks/use-leads";
import type { AstroTagSuggestionsPayload } from "@/features/astro/lib/astro-tag-suggestions";

/**
 * Card interativo para o usuário revisar e aplicar tags sugeridas pelo Closer.
 *
 * Estado inicial: todas as sugestões marcadas. Aplicar usa o router HUMANO
 * (`orpc.leads.addTags` via `useAddTags`) — full audit + dispatch de workflows
 * LEAD_TAGGED + event bus, igual ao botão manual de tag.
 */
export function AstroTagSuggestionsCard({
  payload,
}: {
  payload: AstroTagSuggestionsPayload;
}) {
  const queryClient = useQueryClient();
  const addTags = useAddTags();

  const allIds = payload.suggestions.map((s) => s.tagId);
  const [selected, setSelected] = useState<Set<string>>(new Set(allIds));
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  const toggle = (tagId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const apply = (tagIds: string[]) => {
    if (tagIds.length === 0) return;
    addTags.mutate(
      { leadId: payload.leadId, tagIds },
      {
        onSuccess: () => {
          setAppliedCount(tagIds.length);
          queryClient.invalidateQueries({
            queryKey: orpc.tags.getTagByLead.queryKey({
              input: { leadId: payload.leadId },
            }),
          });
        },
      },
    );
  };

  if (payload.suggestions.length === 0) {
    return (
      <div className="w-full rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-500">
        Nenhuma tag nova a sugerir
        {payload.skipped && payload.skipped.length > 0
          ? ` — ${payload.skipped.length} já estavam aplicadas ou fora do catálogo.`
          : "."}
      </div>
    );
  }

  if (appliedCount !== null) {
    return (
      <div className="flex w-full items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
        <CheckCircle2 className="size-4" />
        {appliedCount} tag{appliedCount !== 1 ? "s" : ""} aplicada
        {appliedCount !== 1 ? "s" : ""} ao lead.
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-900/40">
      <div className="flex items-center gap-2 border-b border-zinc-800/80 px-3 py-2 text-[11px] uppercase tracking-wider text-zinc-500">
        <TagIcon className="size-3.5" />
        Sugestões de tag
      </div>

      <ul className="divide-y divide-zinc-800/60">
        {payload.suggestions.map((s) => {
          const checked = selected.has(s.tagId);
          return (
            <li key={s.tagId}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-zinc-900/60",
                  checked && "bg-zinc-900/40",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(s.tagId)}
                  className="mt-0.5"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{
                        backgroundColor: s.tagColor ?? "#1447e6",
                      }}
                      aria-hidden
                    />
                    <span className="text-xs font-medium text-zinc-200">
                      {s.tagName}
                    </span>
                  </span>
                  <span className="text-[11px] text-zinc-400">{s.reason}</span>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      {payload.skipped && payload.skipped.length > 0 && (
        <div className="border-t border-zinc-800/80 px-3 py-1.5 text-[10px] text-zinc-500">
          {payload.skipped.length} tag
          {payload.skipped.length !== 1 ? "s" : ""} ignorada
          {payload.skipped.length !== 1 ? "s" : ""} (já aplicadas ou fora do
          catálogo).
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={addTags.isPending}
          onClick={() => apply(allIds)}
        >
          Aplicar todas
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={selected.size === 0 || addTags.isPending}
          onClick={() => apply([...selected])}
        >
          Aplicar selecionadas ({selected.size})
        </Button>
      </div>
    </div>
  );
}
