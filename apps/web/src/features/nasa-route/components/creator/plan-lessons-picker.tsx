"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface LessonLite {
  id: string;
  title: string;
  moduleId: string | null;
  order: number;
}

interface ModuleLite {
  id: string;
  title: string;
}

interface Plan {
  id: string;
  name: string;
  lessonIds: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
  plan: Plan;
  lessons: LessonLite[];
  modules: ModuleLite[];
}

export function PlanLessonsPicker({
  open,
  onClose,
  courseId,
  plan,
  lessons,
  modules,
}: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(plan.lessonIds),
  );

  const grouped = useMemo(() => {
    const byModule = new Map<string | null, LessonLite[]>();
    for (const l of lessons) {
      const arr = byModule.get(l.moduleId) ?? [];
      arr.push(l);
      byModule.set(l.moduleId, arr);
    }
    for (const arr of byModule.values()) arr.sort((a, b) => a.order - b.order);

    const groups: Array<{ id: string | null; title: string | null; lessons: LessonLite[] }> = [];
    const noMod = byModule.get(null) ?? [];
    if (noMod.length > 0) {
      groups.push({ id: null, title: null, lessons: noMod });
    }
    for (const m of modules) {
      const arr = byModule.get(m.id) ?? [];
      if (arr.length > 0) groups.push({ id: m.id, title: m.title, lessons: arr });
    }
    return groups;
  }, [lessons, modules]);

  const save = useMutation({
    ...orpc.nasaRoute.creatorSetPlanLessons.mutationOptions(),
    onSuccess: () => {
      toast.success("Aulas atualizadas!");
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorListPlans.queryKey({ input: { courseId } }),
      });
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({ input: { courseId } }),
      });
      onClose();
    },
    onError: (err: any) => toast.error(err?.message ?? "Falha ao salvar."),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(lessons.map((l) => l.id)));
  }
  function clearAll() {
    setSelected(new Set());
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aulas do plano: {plan.name}</DialogTitle>
          <DialogDescription>
            Marque as aulas que estarão disponíveis para os alunos deste plano.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            {selected.size} de {lessons.length} aulas selecionadas
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={selectAll}>
              Marcar todas
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearAll}>
              Limpar
            </Button>
          </div>
        </div>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {grouped.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Adicione aulas ao curso antes de configurar o plano.
            </p>
          )}
          {grouped.map((g) => (
            <div key={g.id ?? "no-module"}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {g.title ?? "Aulas avulsas"}
              </p>
              <ul className="space-y-1">
                {g.lessons.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <Checkbox
                      id={`lesson-${l.id}`}
                      checked={selected.has(l.id)}
                      onCheckedChange={() => toggle(l.id)}
                    />
                    <Label
                      htmlFor={`lesson-${l.id}`}
                      className="flex-1 cursor-pointer text-sm font-normal"
                    >
                      {l.title}
                    </Label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={save.isPending}
            onClick={() =>
              save.mutate({ planId: plan.id, lessonIds: [...selected] })
            }
            className="gap-1.5"
          >
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
