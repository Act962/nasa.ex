"use client";

import { useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePlannerClientPost } from "../../hooks/use-planner-planning";
import { useParsePlannerWeeklyScript, useSetPlannerWeekdayTheme } from "../../hooks/use-planner-weekly-script";
import { POST_TYPE_META, WEEKDAY_LABELS } from "./planner-v2-utils";
import type { PlannerClient } from "./planner-v2-types";

/** "Colar roteiro da semana" (spec 0067, RF-3): cola o texto, o Astro separa, o usuário confere e cria as pautas. */

type ParsedItem = NonNullable<ReturnType<typeof useParsePlannerWeeklyScript>["data"]>["items"][number];

const STORY_HOUR = 12;
const DEFAULT_HOUR = 18;

/** Segunda-feira da semana do roteiro: a da semana visível, ou a próxima se ela já passou. */
function scriptWeekMonday(anchorDate: Date) {
  const monday = addDays(startOfWeek(anchorDate, { weekStartsOn: 0 }), 1);
  return addDays(monday, 6).getTime() < Date.now() ? addDays(monday, 7) : monday;
}

function intendedDateFor(monday: Date, item: ParsedItem, sameDayIndex: number) {
  const date = addDays(monday, (item.weekday + 6) % 7);
  date.setHours((item.format === "STORY" ? STORY_HOUR : DEFAULT_HOUR) + sameDayIndex, 0, 0, 0);
  return date;
}

export function ImportWeeklyScriptDialog({ isOpen, clients, anchorDate, defaultOrganizationId, onClose }: { isOpen: boolean; clients: PlannerClient[]; anchorDate: Date; defaultOrganizationId?: string; onClose: () => void }) {
  const creatableClients = clients.filter((client) => client.permissions.canCreate);
  const [chosenOrganizationId, setOrganizationId] = useState("");
  const organizationId = chosenOrganizationId || defaultOrganizationId || creatableClients[0]?.id || "";
  const [text, setText] = useState("");
  const [items, setItems] = useState<ParsedItem[] | null>(null);
  const [shouldApplyThemes, setShouldApplyThemes] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const parseScript = useParsePlannerWeeklyScript();
  const createPost = useCreatePlannerClientPost();
  const setTheme = useSetPlannerWeekdayTheme();
  const monday = scriptWeekMonday(anchorDate);

  const close = () => {
    setItems(null);
    setText("");
    onClose();
  };
  const separate = () =>
    parseScript.mutate(
      { organizationId, text },
      {
        onSuccess: (result) => (result.items.length ? setItems(result.items) : toast.error("O Astro não achou conteúdos por dia nesse texto.")),
        onError: (error) => toast.error(error.message),
      },
    );

  const createAll = async () => {
    if (!items) return;
    setIsCreating(true);
    const countByWeekday = new Map<number, number>();
    let createdCount = 0;
    try {
      for (const item of items) {
        const sameDayIndex = countByWeekday.get(item.weekday) ?? 0;
        countByWeekday.set(item.weekday, sameDayIndex + 1);
        await createPost.mutateAsync({
          organizationId,
          type: item.format,
          status: "IDEA",
          title: item.title.slice(0, 200),
          script: item.script || undefined,
          objective: item.objective.slice(0, 200) || undefined,
          cta: item.cta.slice(0, 300) || undefined,
          caption: item.caption.slice(0, 2200) || undefined,
          intendedAt: intendedDateFor(monday, item, sameDayIndex),
        });
        createdCount += 1;
      }
      if (shouldApplyThemes) {
        const themeByWeekday = new Map(items.filter((item) => item.objective).map((item) => [item.weekday, item.objective] as const));
        for (const [weekday, theme] of themeByWeekday) await setTheme.mutateAsync({ organizationId, weekday, theme: theme.slice(0, 80) });
      }
      toast.success(`${createdCount} pautas criadas na semana de ${format(monday, "dd/MM")}.`);
      close();
    } catch (error) {
      toast.error(`${createdCount} de ${items.length} criadas. ${error instanceof Error ? error.message : ""}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[22px] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Colar roteiro da semana</DialogTitle>
          <DialogDescription>
            Cole o roteiro como você escreveu. O Astro separa por dia, sem reescrever, e cada conteúdo vira uma pauta na semana de {format(monday, "dd/MM")} a {format(addDays(monday, 6), "dd/MM")}.
          </DialogDescription>
        </DialogHeader>
        {creatableClients.length > 1 && (
          <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="w-full max-w-xs rounded-full bg-panel px-3 py-1.5 text-sm">
            {creatableClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        )}
        {items === null ? (
          <>
            <Textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={"SEGUNDA — REEL\nTema: …\nNarração: …\nDescrição: …"} className="min-h-64 rounded-2xl text-sm" />
            <div className="flex justify-end">
              <button type="button" disabled={text.trim().length < 40 || !organizationId || parseScript.isPending} onClick={separate} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-40">
                {parseScript.isPending && <OrbitaSpinner className="size-4" />}
                {parseScript.isPending ? "O Astro está separando…" : "Separar por dia"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              {items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex items-start gap-3 rounded-2xl bg-panel p-2.5">
                  <span className="w-10 pt-0.5 text-[11px] font-bold text-muted-foreground uppercase">{WEEKDAY_LABELS[item.weekday].slice(0, 3)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {POST_TYPE_META[item.format].label}
                      {item.objective && ` · ${item.objective}`}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {item.script ? "roteiro ✓" : "sem roteiro"} · {item.caption ? "legenda ✓" : "sem legenda"} · {item.cta ? "CTA ✓" : "sem CTA"}
                    </span>
                  </span>
                  <button type="button" aria-label="Tirar da lista" onClick={() => setItems(items.filter((_, index) => index !== itemIndex))} className="rounded-full bg-knob/60 px-2 py-0.5 text-[11px]">
                    Tirar
                  </button>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={shouldApplyThemes} onChange={(event) => setShouldApplyThemes(event.target.checked)} />
              Usar os objetivos como tema fixo de cada dia da semana
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={isCreating} onClick={() => setItems(null)} className="rounded-full bg-panel px-4 py-2 text-sm">
                Voltar ao texto
              </button>
              <button type="button" disabled={isCreating || items.length === 0} onClick={() => void createAll()} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-40">
                {isCreating && <OrbitaSpinner className="size-4" />}
                Criar {items.length} pauta{items.length === 1 ? "" : "s"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
