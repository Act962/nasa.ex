"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  CheckCircle2,
  ChevronLeft,
  Clock,
  GraduationCap,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoEmbed } from "../shared/video-embed";
import { PriceStarsDisplay } from "../shared/price-stars-display";
import { EnrollmentModal } from "../student/enrollment-modal";
import { PublicCheckoutModal } from "./public-checkout-modal";
import { FormatCtaButton } from "./format-cta-button";
import { FormatDetailsSection } from "./format-details-section";
import { CoursePlansSection } from "./course-plans-section";
import { CourseLessonsSection } from "./course-lessons-section";
import { COURSE_FORMAT_LABELS, COURSE_LEVEL_LABELS } from "../../types";
import { hasLessons } from "../../lib/formats";
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
  const plans = course.plans ?? [];
  const hasMultiplePlans = plans.length > 1;
  const defaultPlan = plans.find((p) => p.isDefault) ?? plans[0] ?? null;
  const headlinePriceStars = course.minPriceStars ?? course.priceStars;
  const isFree = headlinePriceStars === 0;
  const lessonsBased = hasLessons(course.format);

  const signInHref = `/sign-in?redirect=${encodeURIComponent(
    `/c/${companySlug}/${courseSlug}`,
  )}`;
  const signUpHref = `/sign-up?callbackUrl=${encodeURIComponent(
    `/c/${companySlug}/${courseSlug}`,
  )}`;

  // BRL formatado pra um plano (usado nos botões de unauth + cursos com aulas)
  const formatPlanBrl = (priceStars: number) =>
    (priceStars * starPriceBrl).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  // Headline CTA pro hero (apenas formatos lessons-based — formatos especiais
  // usam <FormatCtaButton /> com labels próprios "Comprar eBook", etc).
  const heroCtaLabel = isFree
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
    if (isFree) {
      // produto gratuito: precisa criar conta normal
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
            {lessonsBased && (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="size-4" />
                {course.lessons.length} aulas
              </span>
            )}
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
          {!isAuthenticated && !isFree && !hasMultiplePlans && defaultPlan && lessonsBased && (
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              ≈ {formatPlanBrl(defaultPlan.priceStars)} via cartão
            </p>
          )}
          <div className="mt-4">
            {lessonsBased ? (
              <Button size="lg" className="w-full" onClick={handleHeroClick}>
                {heroCtaLabel}
              </Button>
            ) : isAuthenticated ? (
              <FormatCtaButton
                format={course.format}
                priceStars={headlinePriceStars}
                isFree={isFree}
                hasMultiplePlans={hasMultiplePlans}
                eventStartsAt={course.eventStartsAt}
                eventEndsAt={course.eventEndsAt}
                onClick={() =>
                  startEnrollment(hasMultiplePlans ? null : defaultPlan?.id ?? null)
                }
              />
            ) : (
              <FormatCtaButton
                format={course.format}
                priceStars={headlinePriceStars}
                isFree={isFree}
                hasMultiplePlans={hasMultiplePlans}
                eventStartsAt={course.eventStartsAt}
                eventEndsAt={course.eventEndsAt}
                href={signInHref}
              />
            )}
          </div>
          {!isAuthenticated && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {isFree
                ? "Crie sua conta em segundos"
                : lessonsBased
                  ? "Compra direta · sem precisar criar conta antes"
                  : "Faça login pra continuar"}
            </p>
          )}
          {isAuthenticated && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Pago com STARs da sua conta
            </p>
          )}
        </aside>
      </header>

      <CoursePlansSection
        plans={plans}
        totalLessons={course.lessons.length}
        rewardSpOnComplete={course.rewardSpOnComplete}
        isAuthenticated={isAuthenticated}
        signInHref={signInHref}
        signUpHref={signUpHref}
        starPriceBrl={starPriceBrl}
        onSelectPlan={(planId) => startEnrollment(planId)}
        onPublicCheckout={(plan) => startPublicCheckout(plan)}
      />

      {/* Conteúdo do curso — só pra formatos com aulas */}
      {lessonsBased && (
        <CourseLessonsSection
          modules={course.modules}
          lessons={course.lessons}
          companySlug={companySlug}
          courseSlug={courseSlug}
        />
      )}

      {/* Detalhes específicos por formato — eBook (tamanho/páginas), evento (data/hora), etc */}
      <FormatDetailsSection
        format={course.format}
        priceStars={headlinePriceStars}
        ebookFileSize={course.ebookFileSize}
        ebookMimeType={course.ebookMimeType}
        ebookPageCount={course.ebookPageCount}
        eventStartsAt={course.eventStartsAt}
        eventTimezone={course.eventTimezone}
        eventLocationNote={course.eventLocationNote}
        communityType={course.communityType}
      />

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
