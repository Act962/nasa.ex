"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Gift,
  Loader2,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StarsPurchaseModal } from "@/features/stars/components/stars-purchase-modal";

type Step = "select-plan" | "confirm" | "processing" | "success" | "insufficient";

interface PlanLite {
  id: string;
  name: string;
  description: string | null;
  priceStars: number;
  isDefault: boolean;
  lessonCount: number;
  attachmentCount: number;
}

interface EnrollmentModalProps {
  open: boolean;
  onClose: () => void;
  course: {
    id: string;
    title: string;
    priceStars: number;
    creatorOrg?: { name: string } | null;
    plans?: PlanLite[];
  };
  initialPlanId?: string | null;
}

export function EnrollmentModal({
  open,
  onClose,
  course,
  initialPlanId = null,
}: EnrollmentModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const plans = course.plans ?? [];
  const hasMultiplePlans = plans.length > 1;
  const fallbackPlan = plans.find((p) => p.isDefault) ?? plans[0] ?? null;

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    initialPlanId ?? (hasMultiplePlans ? null : fallbackPlan?.id ?? null),
  );
  const [step, setStep] = useState<Step>(() => {
    if (initialPlanId) return "confirm";
    return hasMultiplePlans ? "select-plan" : "confirm";
  });
  const [errorInfo, setErrorInfo] = useState<{
    balance: number;
    bonusBalance: number;
    needed: number;
  } | null>(null);
  const [showStarsModal, setShowStarsModal] = useState(false);

  // Reset state when modal reopens with a different initialPlanId
  useEffect(() => {
    if (!open) return;
    setSelectedPlanId(initialPlanId ?? (hasMultiplePlans ? null : fallbackPlan?.id ?? null));
    setStep(initialPlanId || !hasMultiplePlans ? "confirm" : "select-plan");
    setErrorInfo(null);
  }, [open, initialPlanId, hasMultiplePlans, fallbackPlan?.id]);

  const { data: balanceData } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
    enabled: open,
  });

  const balance = balanceData?.balance ?? 0;
  const bonusBalance = balanceData?.bonusBalance ?? 0;

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? fallbackPlan,
    [plans, selectedPlanId, fallbackPlan],
  );

  const priceStars = selectedPlan?.priceStars ?? course.priceStars;
  const isFree = priceStars === 0;

  const purchaseMutation = useMutation({
    ...orpc.nasaRoute.purchaseCourse.mutationOptions(),
    onMutate: () => setStep("processing"),
    onSuccess: (res) => {
      setStep("success");
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.listMyEnrollments.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.stars.getBalance.queryKey(),
      });

      setTimeout(() => {
        onClose();
        router.push(`/nasa-route/curso/${course.id}`);
      }, 1600);

      if (res.source === "free_access") {
        toast.success("Acesso liberado!", {
          description: "Você foi adicionado à lista de acesso livre deste curso.",
        });
      }
    },
    onError: (err: any) => {
      const code = err?.data?.code;
      if (code === "INSUFFICIENT_STARS") {
        setErrorInfo({
          balance: err.data.balance ?? balance,
          bonusBalance: err.data.bonusBalance ?? bonusBalance,
          needed: err.data.needed ?? priceStars,
        });
        setStep("insufficient");
        return;
      }
      toast.error(err?.message ?? "Não foi possível concluir a compra.");
      setStep("confirm");
    },
  });

  function handleConfirm() {
    if (!isFree && balance < priceStars) {
      setErrorInfo({ balance, bonusBalance, needed: priceStars });
      setStep("insufficient");
      return;
    }
    purchaseMutation.mutate({
      courseId: course.id,
      planId: selectedPlan?.id,
    });
  }

  function handleClose() {
    if (step === "processing") return;
    setStep(hasMultiplePlans ? "select-plan" : "confirm");
    setErrorInfo(null);
    onClose();
  }

  function handleOpenStarsModal() {
    setShowStarsModal(true);
  }

  function handleStarsModalClose() {
    setShowStarsModal(false);
    queryClient.invalidateQueries({ queryKey: orpc.stars.getBalance.queryKey() });
    setStep("confirm");
    setErrorInfo(null);
  }

  function handlePickPlan(planId: string) {
    setSelectedPlanId(planId);
    setStep("confirm");
  }

  return (
    <>
      <Dialog open={open && !showStarsModal} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {step === "select-plan" && (
            <>
              <DialogHeader>
                <DialogTitle>Escolha seu plano</DialogTitle>
                <DialogDescription>{course.title}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                {plans.map((plan) => {
                  const planFree = plan.priceStars === 0;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => handlePickPlan(plan.id)}
                      className={cn(
                        "group flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition hover:border-violet-400 hover:bg-violet-50/40 dark:hover:bg-violet-900/10",
                        plan.isDefault
                          ? "border-violet-300 bg-violet-50/50 dark:border-violet-700/50 dark:bg-violet-900/10"
                          : "border-border bg-card",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-base font-semibold">{plan.name}</h4>
                          {plan.isDefault && (
                            <Badge className="bg-violet-600 text-[10px] text-white hover:bg-violet-600">
                              Recomendado
                            </Badge>
                          )}
                        </div>
                        {plan.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {plan.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>
                            <strong>{plan.lessonCount}</strong>{" "}
                            {plan.lessonCount === 1 ? "aula" : "aulas"}
                          </span>
                          {plan.attachmentCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <FileText className="size-3" />
                              {plan.attachmentCount}{" "}
                              {plan.attachmentCount === 1 ? "material" : "materiais"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {planFree ? (
                          <span className="font-bold text-emerald-700 dark:text-emerald-300">
                            Grátis
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 font-bold text-amber-700 dark:text-amber-300">
                            <Star className="size-3.5 fill-current" />
                            {plan.priceStars.toLocaleString("pt-BR")}
                          </span>
                        )}
                        <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-violet-600" />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
              </div>
            </>
          )}

          {step === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {isFree ? "Acessar curso gratuito" : "Confirmar compra"}
                </DialogTitle>
                <DialogDescription>{course.title}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {selectedPlan && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900/40 dark:bg-violet-900/10">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-violet-700 dark:text-violet-300">
                          Plano selecionado
                        </p>
                        <p className="mt-0.5 font-semibold">{selectedPlan.name}</p>
                        {selectedPlan.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {selectedPlan.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>
                            <strong>{selectedPlan.lessonCount}</strong>{" "}
                            {selectedPlan.lessonCount === 1 ? "aula" : "aulas"}
                          </span>
                          {selectedPlan.attachmentCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <FileText className="size-3" />
                              {selectedPlan.attachmentCount}{" "}
                              {selectedPlan.attachmentCount === 1
                                ? "material"
                                : "materiais"}
                            </span>
                          )}
                        </div>
                      </div>
                      {hasMultiplePlans && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setStep("select-plan")}
                          className="shrink-0 text-xs"
                        >
                          Trocar
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {isFree ? "Investimento" : "Preço"}
                    </span>
                    <span className="text-lg font-bold">
                      {isFree ? (
                        <span className="text-emerald-700 dark:text-emerald-300">Gratuito</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                          <Sparkles className="size-4" />
                          {priceStars.toLocaleString("pt-BR")} ★
                        </span>
                      )}
                    </span>
                  </div>
                  {!isFree && (
                    <>
                      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
                        <span className="text-muted-foreground">
                          Seu saldo gastável
                        </span>
                        <span className="font-medium tabular-nums">
                          {balance.toLocaleString("pt-BR")} ★
                        </span>
                      </div>
                      {bonusBalance > 0 && (
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            Bônus{" "}
                            <span className="opacity-70">(não vale aqui)</span>
                          </span>
                          <span className="tabular-nums">
                            {bonusBalance.toLocaleString("pt-BR")} ★
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {course.creatorOrg && (
                  <p className="text-xs text-muted-foreground">
                    Curso criado por <strong>{course.creatorOrg.name}</strong>. Após a
                    compra você terá acesso vitalício às aulas e materiais inclusos no
                    plano selecionado, e ganha Space Points por cada aula concluída.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleConfirm} className="flex-1">
                  {isFree ? "Acessar agora" : "Confirmar compra"}
                </Button>
              </div>
            </>
          )}

          {step === "processing" && (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto size-10 animate-spin text-violet-600" />
              <p className="mt-4 text-sm font-medium">Processando matrícula…</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Estamos liberando o acesso ao seu curso.
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="py-10 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-4 text-base font-semibold">Matrícula concluída!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Levando você para o curso…
              </p>
            </div>
          )}

          {step === "insufficient" && errorInfo && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-amber-500" />
                  Saldo insuficiente
                </DialogTitle>
                <DialogDescription>
                  Você precisa de mais STARs para acessar este plano.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Necessário</span>
                    <span className="font-bold text-amber-700 dark:text-amber-300">
                      {errorInfo.needed.toLocaleString("pt-BR")} ★
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Seu saldo gastável
                    </span>
                    <span className="font-medium tabular-nums">
                      {errorInfo.balance.toLocaleString("pt-BR")} ★
                    </span>
                  </div>
                  {errorInfo.bonusBalance > 0 && (
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Bônus disponível</span>
                      <span className="tabular-nums">
                        {errorInfo.bonusBalance.toLocaleString("pt-BR")} ★
                      </span>
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">Faltam</span>
                    <span className="font-bold">
                      {(errorInfo.needed - errorInfo.balance).toLocaleString("pt-BR")} ★
                    </span>
                  </div>
                </div>

                {errorInfo.bonusBalance > 0 && (
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
                    Você tem{" "}
                    <strong>
                      {errorInfo.bonusBalance.toLocaleString("pt-BR")} ★
                    </strong>{" "}
                    de bônus, mas o bônus não pode ser usado pra cursos do NASA
                    Router. Adquira STARS gastáveis abaixo.
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleOpenStarsModal} className="flex-1 gap-1">
                  <Gift className="size-4" />
                  Comprar STARs
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <StarsPurchaseModal open={showStarsModal} onClose={handleStarsModalClose} />
    </>
  );
}
