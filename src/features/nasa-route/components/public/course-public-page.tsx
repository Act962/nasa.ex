"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileText,
  GraduationCap,
  Link2,
  Lock,
  Play,
  Star,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { VideoEmbed } from "../shared/video-embed";
import { PriceStarsDisplay } from "../shared/price-stars-display";
import { EnrollmentModal } from "../student/enrollment-modal";
import { PublicCheckoutModal } from "./public-checkout-modal";
import { COURSE_FORMAT_LABELS, COURSE_LEVEL_LABELS } from "../../types";
import { imgSrc } from "@/features/public-calendar/utils/img-src";

interface Props {
  companySlug: string;
  courseSlug: string;
  isAuthenticated?: boolean;
  /** Cotação de 1 STAR em BRL — vinda do server (singleton RouterPaymentSettings). */
  starPriceBrl?: number;
}

interface PublicCheckoutPlan {
  id: string;
  name: string;
  priceStars: number;
}

export function CoursePublicPage({
  companySlug,
  courseSlug,
  isAuthenticated = false,
  starPriceBrl = 0.15,
}: Props) {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [publicCheckoutPlan, setPublicCheckoutPlan] =
    useState<PublicCheckoutPlan | null>(null);
  const { data, isLoading, isError } = useQuery({
    ...orpc.nasaRoute.publicGetCourse.queryOptions({
      input: { companySlug, courseSlug },
    }),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-4 h-64 w-full rounded-3xl" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Curso não encontrado</h1>
      </div>
    );
  }

  const { org, course } = data;
  const grouped = groupLessonsByModule(course.modules, course.lessons);
  const plans = course.plans ?? [];
  const hasMultiplePlans = plans.length > 1;
  const defaultPlan = plans.find((p) => p.isDefault) ?? plans[0] ?? null;
  const headlinePriceStars = course.minPriceStars ?? course.priceStars;

  const signInHref = `/sign-in?redirect=${encodeURIComponent(
    `/c/${companySlug}/${courseSlug}`,
  )}`;
  const signUpHref = `/sign-up?callbackUrl=${encodeURIComponent(
    `/c/${companySlug}/${courseSlug}`,
  )}`;

  // BRL formatado pra um plano (usado nos botões de unauth)
  const formatPlanBrl = (priceStars: number) =>
    (priceStars * starPriceBrl).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  // Headline CTA pro hero
  const headlineFreeCourse = headlinePriceStars === 0;
  const heroCtaLabel = headlineFreeCourse
    ? "Acessar gratuitamente"
    : !isAuthenticated && !hasMultiplePlans && defaultPlan
      ? `Comprar por ${formatPlanBrl(defaultPlan.priceStars)}`
      : hasMultiplePlans
        ? "Ver planos"
        : "Comprar com STARs";

  function startEnrollment(planId: string | null) {
    setSelectedPlanId(planId);
    setEnrollOpen(true);
  }

  function startPublicCheckout(plan: { id: string; name: string; priceStars: number }) {
    if (plan.priceStars <= 0) return;
    setPublicCheckoutPlan(plan);
  }

  function handleHeroClick() {
    if (headlineFreeCourse) {
      // curso gratuito: precisa criar conta normal
      window.location.href = signUpHref;
      return;
    }
    if (!isAuthenticated) {
      // 1 plano único → modal direto. Multi-plano → mostra a seção de planos
      if (!hasMultiplePlans && defaultPlan) {
        startPublicCheckout({
          id: defaultPlan.id,
          name: defaultPlan.name,
          priceStars: defaultPlan.priceStars,
        });
      } else {
        // Scroll suave pra seção de planos
        document
          .getElementById("plans-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    startEnrollment(hasMultiplePlans ? null : defaultPlan?.id ?? null);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href={`/c/${companySlug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar para {org.name}
      </Link>

      <header className="mt-4 grid grid-cols-1 gap-6 rounded-3xl border border-border bg-card p-6 md:grid-cols-[1fr_360px] md:p-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium">
              {COURSE_FORMAT_LABELS[course.format] ?? course.format}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-0.5">
              {COURSE_LEVEL_LABELS[course.level] ?? course.level}
            </span>
            {course.category && (
              <span className="rounded-full bg-muted px-2.5 py-0.5">{course.category.name}</span>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{course.title}</h1>
          {course.subtitle && (
            <p className="mt-2 text-lg text-muted-foreground">{course.subtitle}</p>
          )}
          {course.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {course.description}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="size-4" />
              {course.lessons.length} aulas
            </span>
            {course.durationMin && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" />
                {course.durationMin} min
              </span>
            )}
            {course.studentsCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" />
                {course.studentsCount} alunos
              </span>
            )}
            {course.creator && (
              <span className="inline-flex items-center gap-1.5">
                {course.creator.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.creator.image}
                    alt={course.creator.name ?? ""}
                    className="size-5 rounded-full object-cover"
                  />
                )}
                Por {course.creator.name}
              </span>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-border bg-muted/30 p-5">
          <div className="overflow-hidden rounded-xl">
            {course.trailer.embedUrl ? (
              <VideoEmbed url={course.trailer.embedUrl} title={`Trailer · ${course.title}`} />
            ) : course.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgSrc(course.coverUrl)}
                alt={course.title}
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 text-violet-500/40">
                <GraduationCap className="size-16" />
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs uppercase text-muted-foreground">
              {hasMultiplePlans ? "A partir de" : "Investimento"}
            </span>
            <PriceStarsDisplay priceStars={headlinePriceStars} size="lg" />
          </div>
          {!isAuthenticated && !headlineFreeCourse && !hasMultiplePlans && defaultPlan && (
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              ≈ {formatPlanBrl(defaultPlan.priceStars)} via cartão
            </p>
          )}
          <Button
            size="lg"
            className="mt-4 w-full"
            onClick={handleHeroClick}
          >
            {heroCtaLabel}
          </Button>
          {!isAuthenticated && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {headlineFreeCourse
                ? "Crie sua conta em segundos"
                : "Compra direta · sem precisar criar conta antes"}
            </p>
          )}
          {isAuthenticated && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Pago com STARs da sua conta
            </p>
          )}
        </aside>
      </header>

      {plans.length > 0 && (
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
                        {course.lessons.length > plan.lessonCount && (
                          <span className="text-muted-foreground"> de {course.lessons.length}</span>
                        )}
                      </span>
                    </li>
                    {plan.attachments.length > 0 && (
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <span>
                          <strong>{plan.attachments.length}</strong>{" "}
                          {plan.attachments.length === 1 ? "material extra" : "materiais extras"}
                        </span>
                      </li>
                    )}
                    {course.rewardSpOnComplete > 0 && (
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <span>
                          +{course.rewardSpOnComplete} Space Points ao concluir
                        </span>
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
                        onClick={() => startEnrollment(plan.id)}
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
                          startPublicCheckout({
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
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold">Conteúdo do curso</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {course.lessons.length} aulas · {course.lessons.filter((l) => l.isFreePreview).length}{" "}
          gratuitas
        </p>

        <div className="mt-4 space-y-3">
          {grouped.map((group) => (
            <div key={group.id ?? "no-module"} className="rounded-2xl border border-border bg-card">
              {group.title && (
                <div className="border-b border-border px-5 py-3">
                  <h3 className="text-sm font-semibold">{group.title}</h3>
                  {group.summary && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{group.summary}</p>
                  )}
                </div>
              )}
              <ul className="divide-y divide-border">
                {group.lessons.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                      {l.isFreePreview ? (
                        <Play className="size-3.5 text-violet-600" />
                      ) : (
                        <Lock className="size-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      {l.summary && (
                        <p className="truncate text-xs text-muted-foreground">{l.summary}</p>
                      )}
                    </div>
                    {l.durationMin && (
                      <span className="text-[11px] text-muted-foreground">{l.durationMin} min</span>
                    )}
                    {l.isFreePreview ? (
                      <Link
                        href={`/c/${companySlug}/${courseSlug}/preview/${l.id}`}
                        className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
                      >
                        Assistir grátis
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Lock className="size-3" />
                        Bloqueado
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {course.rewardSpOnComplete > 0 && (
        <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5" />
            <p className="text-sm font-medium">
              Conclua todas as aulas e ganhe +{course.rewardSpOnComplete} Space Points de bônus!
            </p>
          </div>
        </section>
      )}

      {isAuthenticated && enrollOpen && (
        <EnrollmentModal
          open={enrollOpen}
          onClose={() => {
            setEnrollOpen(false);
            setSelectedPlanId(null);
          }}
          course={{
            id: course.id,
            title: course.title,
            priceStars: course.priceStars,
            creatorOrg: { name: org.name },
            plans: plans.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              priceStars: p.priceStars,
              isDefault: p.isDefault,
              lessonCount: p.lessonCount,
              attachmentCount: p.attachments.length,
            })),
          }}
          initialPlanId={selectedPlanId}
        />
      )}

      {!isAuthenticated && publicCheckoutPlan && (
        <PublicCheckoutModal
          open={!!publicCheckoutPlan}
          onClose={() => setPublicCheckoutPlan(null)}
          course={{
            id: course.id,
            title: course.title,
            creatorOrgName: org.name,
          }}
          plan={publicCheckoutPlan}
          amountBrl={publicCheckoutPlan.priceStars * starPriceBrl}
        />
      )}
    </div>
  );
}

function groupLessonsByModule(
  modules: Array<{ id: string; title: string; summary: string | null; order: number }>,
  lessons: Array<{ id: string; moduleId: string | null; title: string; summary: string | null; durationMin: number | null; isFreePreview: boolean; order: number }>,
) {
  const byModule = new Map<string | null, typeof lessons>();
  for (const l of lessons) {
    const key = l.moduleId;
    const arr = byModule.get(key) ?? [];
    arr.push(l);
    byModule.set(key, arr);
  }
  for (const arr of byModule.values()) {
    arr.sort((a, b) => a.order - b.order);
  }

  const groups: Array<{
    id: string | null;
    title: string | null;
    summary: string | null;
    lessons: typeof lessons;
  }> = [];

  // Sem módulo
  const noModule = byModule.get(null) ?? [];
  if (noModule.length > 0) {
    groups.push({ id: null, title: null, summary: null, lessons: noModule });
  }

  // Com módulo
  for (const m of [...modules].sort((a, b) => a.order - b.order)) {
    const ms = byModule.get(m.id) ?? [];
    if (ms.length > 0) {
      groups.push({ id: m.id, title: m.title, summary: m.summary, lessons: ms });
    }
  }

  return groups;
}
