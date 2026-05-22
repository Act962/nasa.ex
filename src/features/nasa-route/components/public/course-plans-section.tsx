"use client";

import Link from "next/link";
import {
  CheckCircle2,
  FileText,
  ImageIcon,
  Link2,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useConstructUrl } from "@/hooks/use-construct-url";

interface PlanData {
  id: string;
  name: string;
  description: string | null;
  /** @deprecated — fonte de verdade do preço é `priceBrlCents` */
  priceStars: number;
  priceBrlCents: number;
  isDefault: boolean;
  lessonCount: number;
  attachments: Array<{
    id: string;
    kind: string;
    title: string;
    description: string | null;
  }>;
}

/** Aulas gratuitas (preview) — exibidas no card do plano default. */
interface FreeLessonLink {
  id: string;
  title: string;
  /** Chave S3 da thumbnail — opcional. Placeholder quando vazio. */
  thumbnailKey?: string | null;
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
  /** Aulas com `isFreePreview=true` — usadas no card "Acesso completo"
   *  pra mostrar quais aulas o visitante pode assistir grátis antes de
   *  comprar. */
  freeLessons?: FreeLessonLink[];
  /** Base URL pra montar links das previews: `${freeLessonsBasePath}/<lessonId>`. */
  freeLessonsBasePath?: string;
  /** chamado quando usuário logado seleciona plano */
  onSelectPlan: (planId: string) => void;
  /** chamado quando usuário NÃO logado clica em comprar plano pago (abre checkout Stripe) */
  onPublicCheckout: (plan: { id: string; name: string; priceBrlCents: number }) => void;
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
  freeLessons,
  freeLessonsBasePath,
  onSelectPlan,
  onPublicCheckout,
}: Props) {
  if (plans.length === 0) return null;

  const hasMultiplePlans = plans.length > 1;
  const formatBrlCents = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", {
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
          const isFree = plan.priceBrlCents <= 0;
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
                  <span className="text-2xl font-bold tabular-nums text-violet-700 dark:text-violet-300">
                    {formatBrlCents(plan.priceBrlCents)}
                  </span>
                )}
              </div>

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
                {/* Aulas gratuitas — só aparece no card "Acesso completo"
                    (default) pra evitar duplicar info em múltiplos planos. */}
                {plan.isDefault && freeLessons && freeLessons.length > 0 && (
                  <li className="flex items-start gap-2">
                    <Play
                      className="mt-0.5 size-4 shrink-0 text-emerald-600"
                      fill="currentColor"
                    />
                    <span>
                      <strong>{freeLessons.length}</strong>{" "}
                      {freeLessons.length === 1 ? "aula" : "aulas"} grátis pra
                      experimentar antes
                    </span>
                  </li>
                )}
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

              {/* Lista de aulas gratuitas (com thumbnail + link) no card
                  "Acesso completo" — destaque visual pra converter
                  visitantes em alunos. */}
              {plan.isDefault &&
                freeLessons &&
                freeLessons.length > 0 &&
                freeLessonsBasePath && (
                  <div className="mt-4 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900/40 dark:bg-emerald-900/20">
                    <p className="font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      🎁 Assista grátis agora:
                    </p>
                    <div className="space-y-1.5">
                      {freeLessons.slice(0, 4).map((lesson) => (
                        <FreeLessonItem
                          key={lesson.id}
                          lesson={lesson}
                          href={`${freeLessonsBasePath}/${lesson.id}`}
                        />
                      ))}
                      {freeLessons.length > 4 && (
                        <p className="pt-1 text-[11px] text-emerald-600/70 dark:text-emerald-400/70">
                          + {freeLessons.length - 4} outras aulas grátis abaixo
                        </p>
                      )}
                    </div>
                  </div>
                )}

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
                        priceBrlCents: plan.priceBrlCents,
                      })
                    }
                  >
                    Comprar por {formatBrlCents(plan.priceBrlCents)}
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

/**
 * Item da seção "Assista grátis agora" — thumbnail (com placeholder
 * quando vazio) + Play overlay + título. `useConstructUrl` é hook,
 * por isso o sub-componente (precisa rodar uma vez por aula).
 */
function FreeLessonItem({
  lesson,
  href,
}: {
  lesson: FreeLessonLink;
  href: string;
}) {
  const thumbUrl = useConstructUrl(lesson.thumbnailKey || "");

  return (
    <Link
      href={href}
      className="group flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30"
    >
      <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded border border-emerald-200/60 bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-950/40">
        {lesson.thumbnailKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={lesson.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="size-3 text-emerald-600/50" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-emerald-700/40 transition-colors group-hover:bg-emerald-600/50">
          <Play className="size-3.5 text-white" fill="white" />
        </div>
      </div>
      <span className="min-w-0 flex-1 truncate text-emerald-700 transition-colors group-hover:text-emerald-900 dark:text-emerald-300 dark:group-hover:text-emerald-100">
        {lesson.title}
      </span>
    </Link>
  );
}
