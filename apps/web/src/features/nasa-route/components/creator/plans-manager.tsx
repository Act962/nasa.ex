"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  CheckCircle2,
  FileText,
  Link2,
  Loader2,
  Folder,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlanForm } from "./plan-form";
import { PlanLessonsPicker } from "./plan-lessons-picker";
import { PlanAttachmentsList } from "./plan-attachments-list";

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

interface Props {
  courseId: string;
  lessons: LessonLite[];
  modules: ModuleLite[];
}

export function PlansManager({ courseId, lessons, modules }: Props) {
  const qc = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [confirmDeletePlanId, setConfirmDeletePlanId] = useState<string | null>(null);
  const [openLessonsPicker, setOpenLessonsPicker] = useState<string | null>(null);
  const [openAttachments, setOpenAttachments] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    ...orpc.nasaRoute.creatorListPlans.queryOptions({ input: { courseId } }),
  });

  const removePlan = useMutation({
    ...orpc.nasaRoute.creatorDeletePlan.mutationOptions(),
    onSuccess: () => {
      toast.success("Plano excluído");
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorListPlans.queryKey({ input: { courseId } }),
      });
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({ input: { courseId } }),
      });
      setConfirmDeletePlanId(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Falha ao excluir."),
  });

  const plans = data?.plans ?? [];

  const lessonById = useMemo(() => {
    const m = new Map<string, LessonLite>();
    for (const l of lessons) m.set(l.id, l);
    return m;
  }, [lessons]);

  const planForLessonsPicker = useMemo(
    () => plans.find((p) => p.id === openLessonsPicker) ?? null,
    [plans, openLessonsPicker],
  );
  const planForAttachments = useMemo(
    () => plans.find((p) => p.id === openAttachments) ?? null,
    [plans, openAttachments],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 text-sm dark:border-violet-900/40 dark:bg-violet-900/10">
        <p className="font-medium text-violet-900 dark:text-violet-200">
          Planos e entregas
        </p>
        <p className="mt-1 text-violet-800/80 dark:text-violet-200/80">
          Cada plano tem seu próprio preço e seleção de aulas. Use planos para
          oferecer um pacote básico (algumas aulas), um intermediário e um VIP
          (todas as aulas + materiais extras como PDFs e links).
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditingPlan(null);
            setShowPlanForm(true);
          }}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          Novo plano
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
          <Sparkles className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Nenhum plano configurado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crie ao menos 1 plano para que alunos possam comprar este curso.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => {
            const planLessons = plan.lessonIds
              .map((id) => lessonById.get(id))
              .filter((l): l is LessonLite => !!l);
            return (
              <div
                key={plan.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="truncate text-base font-semibold">
                        {plan.name}
                      </h3>
                      {plan.isDefault && (
                        <Badge variant="secondary" className="text-[10px]">
                          Padrão
                        </Badge>
                      )}
                    </div>
                    {plan.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {plan.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingPlan(plan);
                        setShowPlanForm(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDeletePlanId(plan.id)}
                      disabled={plan.enrollmentCount > 0}
                      title={
                        plan.enrollmentCount > 0
                          ? "Plano com alunos não pode ser excluído"
                          : "Excluir plano"
                      }
                    >
                      <Trash2 className="size-4 text-rose-600" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-baseline gap-1">
                  <span
                    className={
                      plan.priceBrlCents === 0
                        ? "text-lg font-bold text-emerald-700 dark:text-emerald-300"
                        : "text-lg font-bold text-foreground"
                    }
                  >
                    {plan.priceBrlCents === 0
                      ? "Grátis"
                      : (plan.priceBrlCents / 100).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="size-3.5" />
                    {planLessons.length} de {lessons.length} aulas
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Folder className="size-3.5" />
                    {plan.attachments.length}{" "}
                    {plan.attachments.length === 1 ? "entrega" : "entregas"}
                  </span>
                  {plan.enrollmentCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="size-3.5" />
                      {plan.enrollmentCount} alunos
                    </span>
                  )}
                </div>

                <div className="mt-auto grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenLessonsPicker(plan.id)}
                    className="gap-1.5"
                  >
                    <BookOpen className="size-3.5" />
                    Aulas
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenAttachments(plan.id)}
                    className="gap-1.5"
                  >
                    <FileText className="size-3.5" />
                    Entregas
                  </Button>
                </div>

                {plan.attachments.length > 0 && (
                  <ul className="mt-1 space-y-1 border-t border-border pt-2 text-xs">
                    {plan.attachments.slice(0, 3).map((att) => (
                      <li
                        key={att.id}
                        className="flex items-center gap-1.5 text-muted-foreground"
                      >
                        {att.kind === "pdf" ? (
                          <FileText className="size-3" />
                        ) : (
                          <Link2 className="size-3" />
                        )}
                        <span className="truncate">{att.title}</span>
                      </li>
                    ))}
                    {plan.attachments.length > 3 && (
                      <li className="text-[11px] text-muted-foreground">
                        + {plan.attachments.length - 3} mais
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showPlanForm && (
        <PlanForm
          open={showPlanForm}
          onClose={() => {
            setShowPlanForm(false);
            setEditingPlan(null);
          }}
          courseId={courseId}
          initial={editingPlan ?? undefined}
        />
      )}

      {openLessonsPicker && planForLessonsPicker && (
        <PlanLessonsPicker
          open={!!openLessonsPicker}
          onClose={() => setOpenLessonsPicker(null)}
          courseId={courseId}
          plan={planForLessonsPicker}
          lessons={lessons}
          modules={modules}
        />
      )}

      {openAttachments && planForAttachments && (
        <PlanAttachmentsList
          open={!!openAttachments}
          onClose={() => setOpenAttachments(null)}
          courseId={courseId}
          plan={planForAttachments}
        />
      )}

      <AlertDialog
        open={!!confirmDeletePlanId}
        onOpenChange={(v) => !v && setConfirmDeletePlanId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o plano permanentemente. Ele só pode ser excluído
              se ainda não tiver alunos matriculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removePlan.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removePlan.isPending}
              onClick={() =>
                confirmDeletePlanId &&
                removePlan.mutate({ planId: confirmDeletePlanId })
              }
              className="bg-rose-600 hover:bg-rose-700"
            >
              {removePlan.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Sim, excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
