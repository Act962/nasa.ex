"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = "select-plan" | "confirm" | "processing" | "success";

interface PlanLite {
  id: string;
  name: string;
  description: string | null;
  /** @deprecated mantido por compat; preço efetivo é `priceBrlCents` */
  priceStars: number;
  priceBrlCents: number;
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
    /** @deprecated — `priceBrlCents` é a fonte de verdade. */
    priceStars: number;
    priceBrlCents: number;
    isFree: boolean;
    creatorOrg?: { name: string } | null;
    plans?: PlanLite[];
    /** URL externa pra redirecionar pós-compra (configurada em
     *  Integrações). Sobrescreve o redirect default (/curso/<id>). */
    redirectUrl?: string | null;
  };
  initialPlanId?: string | null;
}

function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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

  useEffect(() => {
    if (!open) return;
    setSelectedPlanId(
      initialPlanId ?? (hasMultiplePlans ? null : fallbackPlan?.id ?? null),
    );
    setStep(initialPlanId || !hasMultiplePlans ? "confirm" : "select-plan");
  }, [open, initialPlanId, hasMultiplePlans, fallbackPlan?.id]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? fallbackPlan,
    [plans, selectedPlanId, fallbackPlan],
  );

  const priceBrlCents = selectedPlan?.priceBrlCents ?? course.priceBrlCents;
  // O curso/aluno é gratuito quando a flag explícita está marcada OU quando
  // o plano selecionado custa zero. Curso pago com plano gratuito (raro) é
  // tratado como gratuito do ponto de vista do aluno.
  const isFree = course.isFree || priceBrlCents <= 0;

  const purchaseMutation = useMutation({
    ...orpc.nasaRoute.purchaseCourse.mutationOptions(),
    onMutate: () => setStep("processing"),
    onSuccess: (res: any) => {
      if (res.kind === "checkout" && res.checkoutUrl) {
        // Curso pago — redireciona pro Stripe Checkout.
        if (typeof window !== "undefined") {
          window.location.href = res.checkoutUrl;
        }
        return;
      }

      // Curso gratuito ou já matriculado → enrollment direto.
      setStep("success");
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.listMyEnrollments.queryKey(),
      });

      // Tracking events antes do redirect interno.
      if (typeof window !== "undefined") {
        const fbq = (window as any).fbq;
        if (typeof fbq === "function") {
          fbq("track", "Purchase", {
            value: priceBrlCents / 100,
            currency: "BRL",
            content_ids: [course.id],
            content_name: course.title,
            content_type: "product",
          });
        }
        const dataLayer = (window as any).dataLayer;
        if (Array.isArray(dataLayer)) {
          dataLayer.push({
            event: "purchase",
            ecommerce: {
              transaction_id: res.enrollmentId,
              value: priceBrlCents / 100,
              currency: "BRL",
              items: [{ item_id: course.id, item_name: course.title }],
            },
          });
        }
      }

      setTimeout(() => {
        onClose();
        if (course.redirectUrl) {
          window.location.href = course.redirectUrl;
        } else {
          router.push(`/nasa-route/curso/${course.id}`);
        }
      }, 1600);

      if (res.source === "free_access") {
        toast.success("Acesso liberado!", {
          description:
            "Você foi adicionado à lista de acesso livre deste curso.",
        });
      }
    },
    onError: (err: any) => {
      const code = err?.data?.code;
      if (code === "PRICE_NOT_CONFIGURED") {
        toast.error(
          "O criador ainda não configurou o preço deste plano em reais.",
        );
        setStep("confirm");
        return;
      }
      if (code === "STRIPE_NOT_CONFIGURED") {
        toast.error("Pagamento indisponível no momento. Tente novamente em instantes.");
        setStep("confirm");
        return;
      }
      toast.error(err?.message ?? "Não foi possível concluir a matrícula.");
      setStep("confirm");
    },
  });

  function handleConfirm() {
    purchaseMutation.mutate({
      courseId: course.id,
      planId: selectedPlan?.id,
    });
  }

  function handleClose() {
    if (step === "processing") return;
    setStep(hasMultiplePlans ? "select-plan" : "confirm");
    onClose();
  }

  function handlePickPlan(planId: string) {
    setSelectedPlanId(planId);
    setStep("confirm");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {step === "select-plan" && (
          <>
            <DialogHeader>
              <DialogTitle>Escolha seu plano</DialogTitle>
              <DialogDescription>{course.title}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {plans.map((plan) => {
                const planFree = course.isFree || plan.priceBrlCents <= 0;
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
                            {plan.attachmentCount === 1
                              ? "material"
                              : "materiais"}
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
                        <span className="font-bold text-violet-700 dark:text-violet-300">
                          {formatBrl(plan.priceBrlCents)}
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
                      <p className="mt-0.5 font-semibold">
                        {selectedPlan.name}
                      </p>
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
                    {isFree ? "Investimento" : "Total"}
                  </span>
                  <span className="text-lg font-bold">
                    {isFree ? (
                      <span className="text-emerald-700 dark:text-emerald-300">
                        Gratuito
                      </span>
                    ) : (
                      <span className="text-violet-700 dark:text-violet-300">
                        {formatBrl(priceBrlCents)}
                      </span>
                    )}
                  </span>
                </div>
                {!isFree && (
                  <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                    Pagamento processado de forma segura pelo Stripe. Após
                    confirmar, você será redirecionado para a página de
                    pagamento.
                  </p>
                )}
              </div>

              {course.creatorOrg && (
                <p className="text-xs text-muted-foreground">
                  Curso criado por <strong>{course.creatorOrg.name}</strong>.
                  Após a compra você terá acesso vitalício às aulas e
                  materiais inclusos no plano selecionado.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button onClick={handleConfirm} className="flex-1 gap-1.5">
                {!isFree && <CreditCard className="size-4" />}
                {isFree ? "Acessar agora" : "Ir para o pagamento"}
              </Button>
            </div>
          </>
        )}

        {step === "processing" && (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto size-10 animate-spin text-violet-600" />
            <p className="mt-4 text-sm font-medium">
              {isFree ? "Processando matrícula…" : "Abrindo pagamento…"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isFree
                ? "Estamos liberando o acesso ao seu curso."
                : "Você será redirecionado para o Stripe em instantes."}
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
      </DialogContent>
    </Dialog>
  );
}
