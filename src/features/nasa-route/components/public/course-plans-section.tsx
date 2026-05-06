"use client";

import Link from "next/link";
import { CheckCircle2, FileText, Link2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PlanData {
  id: string;
  name: string;
  description: string | null;
  priceStars: number;
  isDefault: boolean;
  lessonCount: number;
  attachments: Array<{
    id: string;
    kind: string;
    title: string;
    description: string | null;
  }>;
}

interface Props {
  plans: PlanData[];
  totalLessons: number;
  rewardSpOnComplete: number;
  isAuthenticated: boolean;
  signInHref: string;
  /** href de cadastro pra plano grátis sem login */
  signUpHref: string;
  /** cotação STAR→BRL pra exibir preço em real no card */
  starPriceBrl: number;
  /** chamado quando usuário logado seleciona plano */
  onSelectPlan: (planId: string) => void;
  /** chamado quando usuário NÃO logado clica em comprar plano pago (abre checkout Stripe) */
  onPublicCheckout: (plan: { id: string; name: string; priceStars: number }) => void;
}

/**
 * Cards de planos do curso. Suporta os 4 cenários:
 *  - logado + grátis ou pago → onSelectPlan(plan.id)
 *  - não logado + grátis → Link pro sign-up
 *  - não logado + pago → onPublicCheckout(plan) → modal de checkout em BRL
 */
export function CoursePlansSection({
  plans,
  totalLessons,
  rewardSpOnComplete,
  isAuthenticated,
  signInHref: _signInHref, // deixado pra futura expansão
  signUpHref,
  starPriceBrl,
  onSelectPlan,
  onPublicCheckout,
}: Props) {
  if (plans.length === 0) return null;

  const hasMultiplePlans = plans.length > 1;
  const formatPlanBrl = (priceStars: number) =>
    (priceStars * starPriceBrl).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  return (
    <section id="plans-section" className="mt-8 scroll-mt-6">
      <h2 className="text-xl font-bold">
        {hasMultiplePlans ? "Escolha seu plano" : "Plano de acesso"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasMultiplePlans
          ? "Compare as opções e escolha a que melhor atende suas necessidades."
          : "O que você recebe ao adquirir este curso."}
      </p>

      <div
        className={cn(
          "mt-4 grid gap-4",
          plans.length === 1
            ? "md:grid-cols-1 max-w-xl"
            : plans.length === 2
              ? "md:grid-cols-2"
              : "md:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {plans.map((plan) => {
          const isFree = plan.priceStars === 0;
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-2xl border p-5 transition",
                plan.isDefault
                  ? "border-violet-300 bg-violet-50/50 shadow-sm dark:border-violet-700/50 dark:bg-violet-900/10"
                  : "border-border bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold">{plan.name}</h3>
                  {plan.description && (
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                  )}
                </div>
                {plan.isDefault && (
                  <Badge className="shrink-0 bg-violet-600 text-white hover:bg-violet-600">
                    Recomendado
                  </Badge>
                )}
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                {isFree ? (
                  <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    Grátis
                  </span>
                ) : (
                  <>
                    <Star className="size-5 fill-amber-500 text-amber-500" />
                    <span className="text-2xl font-bold tabular-nums">
                      {plan.priceStars.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-sm text-muted-foreground">★</span>
                  </>
                )}
              </div>
              {!isFree && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  ≈ {formatPlanBrl(plan.priceStars)} via cartão
                </p>
              )}

              <ul className="mt-4 flex-1 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span>
                    <strong>{plan.lessonCount}</strong>{" "}
                    {plan.lessonCount === 1 ? "aula incluída" : "aulas incluídas"}
                    {totalLessons > plan.lessonCount && (
                      <span className="text-muted-foreground"> de {totalLessons}</span>
                    )}
                  </span>
                </li>
                {plan.attachments.length > 0 && (
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <span>
                      <strong>{plan.attachments.length}</strong>{" "}
                      {plan.attachments.length === 1
                        ? "material extra"
                        : "materiais extras"}
                    </span>
                  </li>
                )}
                {rewardSpOnComplete > 0 && (
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <span>+{rewardSpOnComplete} Space Points ao concluir</span>
                  </li>
                )}
              </ul>

              {plan.attachments.length > 0 && (
                <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                  <p className="font-medium uppercase tracking-wider">Inclui:</p>
                  {plan.attachments.slice(0, 3).map((att) => (
                    <div key={att.id} className="flex items-center gap-1.5">
                      {att.kind === "pdf" ? (
                        <FileText className="size-3" />
                      ) : (
                        <Link2 className="size-3" />
                      )}
                      <span className="truncate">{att.title}</span>
                    </div>
                  ))}
                  {plan.attachments.length > 3 && (
                    <div className="text-[11px]">
                      + {plan.attachments.length - 3} mais
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5">
                {isAuthenticated ? (
                  <Button
                    className="w-full"
                    variant={plan.isDefault ? "default" : "outline"}
                    onClick={() => onSelectPlan(plan.id)}
                  >
                    {isFree ? "Começar agora" : "Comprar este plano"}
                  </Button>
                ) : isFree ? (
                  <Button
                    asChild
                    className="w-full"
                    variant={plan.isDefault ? "default" : "outline"}
                  >
                    <Link href={signUpHref}>Começar agora</Link>
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.isDefault ? "default" : "outline"}
                    onClick={() =>
                      onPublicCheckout({
                        id: plan.id,
                        name: plan.name,
                        priceStars: plan.priceStars,
                      })
                    }
                  >
                    Comprar por {formatPlanBrl(plan.priceStars)}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
