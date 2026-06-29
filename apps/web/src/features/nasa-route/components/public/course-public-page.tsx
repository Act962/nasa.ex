"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
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
// Cursos passaram a ser precificados em BRL nativo — Stars some da
// landing pública. Importação mantida só para outros usos legados.
// import { PriceStarsDisplay } from "../shared/price-stars-display";
import { CourseShareMenu } from "../shared/course-share-menu";
import { EnrollmentModal } from "../student/enrollment-modal";
import { TrackingScripts } from "./tracking-scripts";
import { PublicCheckoutModal } from "./public-checkout-modal";
import { FormatCtaButton } from "./format-cta-button";
import { FormatDetailsSection } from "./format-details-section";
import { CoursePlansSection } from "./course-plans-section";
import { CourseLessonsSection } from "./course-lessons-section";
import { COURSE_FORMAT_LABELS, COURSE_LEVEL_LABELS } from "../../types";
import { hasLessons } from "../../lib/formats";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import { useRouter } from "next/navigation";

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
  priceBrlCents: number;
}

export function CoursePublicPage({
  companySlug,
  courseSlug,
  isAuthenticated = false,
  starPriceBrl = 0.15,
}: Props) {
  const router = useRouter();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [publicCheckoutPlan, setPublicCheckoutPlan] =
    useState<PublicCheckoutPlan | null>(null);
  const { data, isLoading, isError } = useQuery({
    ...orpc.nasaRoute.publicGetCourse.queryOptions({
      input: { companySlug, courseSlug },
    }),
  });

  // Quando autenticado, checa se o usuário já está matriculado neste curso
  // pra trocar o CTA "Comprar" por "Acessar curso".
  const { data: myEnrollmentsData } = useQuery({
    ...orpc.nasaRoute.listMyEnrollments.queryOptions(),
    enabled: isAuthenticated,
  });
  const enrolledInThisCourse = useMemo(() => {
    if (!isAuthenticated || !myEnrollmentsData || !data?.course?.id) return false;
    return myEnrollmentsData.enrollments.some(
      (e) => e.course.id === data.course.id,
    );
  }, [isAuthenticated, myEnrollmentsData, data?.course?.id]);

  // ── Tracking de view (Insights NASA Route) ─────────────
  // Loga uma única vez por carga da página, com UTM params da query
  // string capturados pra atribuição de campanha.
  const searchParams = useSearchParams();
  const trackView = useMutation({
    ...orpc.nasaRoute.trackCourseView.mutationOptions(),
  });
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    const courseId = data?.course?.id;
    if (!courseId) return;
    trackedRef.current = true;
    trackView.mutate({
      courseId,
      utmSource: searchParams.get("utm_source"),
      utmMedium: searchParams.get("utm_medium"),
      utmCampaign: searchParams.get("utm_campaign"),
      utmContent: searchParams.get("utm_content"),
      utmTerm: searchParams.get("utm_term"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.course?.id]);

  const handleBack = () => {
    router.back();
  };

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
  const headlinePriceBrlCents =
    (course as any).minPriceBrlCents ?? (course as any).priceBrlCents ?? 0;
  const isFree = (course as any).isFree || headlinePriceBrlCents <= 0;
  const lessonsBased = hasLessons(course.format);

  const signInHref = `/sign-in?redirect=${encodeURIComponent(
    `/c/${companySlug}/${courseSlug}`,
  )}`;
  const signUpHref = `/sign-up?callbackUrl=${encodeURIComponent(
    `/c/${companySlug}/${courseSlug}`,
  )}`;

  // BRL formatado direto a partir dos centavos do plano.
  const formatBrlCents = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  // Headline CTA pro hero (apenas formatos lessons-based — formatos especiais
  // usam <FormatCtaButton /> com labels próprios "Comprar eBook", etc).
  const heroCtaLabel = isFree
    ? "Acessar gratuitamente"
    : !hasMultiplePlans && defaultPlan
      ? `Comprar por ${formatBrlCents((defaultPlan as any).priceBrlCents ?? 0)}`
      : "Ver planos";

  function startEnrollment(planId: string | null) {
    setSelectedPlanId(planId);
    setEnrollOpen(true);
  }

  function startPublicCheckout(plan: {
    id: string;
    name: string;
    priceBrlCents: number;
  }) {
    if (plan.priceBrlCents <= 0) return;
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
          priceBrlCents: (defaultPlan as any).priceBrlCents ?? 0,
        });
      } else {
        document
          .getElementById("plans-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    startEnrollment(hasMultiplePlans ? null : (defaultPlan?.id ?? null));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Facebook Pixel + Google Tag Manager (injetados quando o
          criador configurou em Integrações). PageView dispara
          automático; eventos de compra são chamados em enrollment-modal. */}
      <TrackingScripts
        pixelId={(course as any).pixelId ?? null}
        gtmId={(course as any).gtmId ?? null}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        className="mb-4 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar para {org.name}
      </Button>

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
              <span className="rounded-full bg-muted px-2.5 py-0.5">
                {course.category.name}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-start justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {course.title}
            </h1>
            <CourseShareMenu
              url={`/c/${companySlug}/${courseSlug}`}
              text={`${course.title} — ${course.subtitle ?? "Confira este curso na NASA Route"}`}
              variant="button"
              label="Compartilhar"
            />
          </div>
          {course.subtitle && (
            <p className="mt-2 text-lg text-muted-foreground">
              {course.subtitle}
            </p>
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
              <VideoEmbed
                url={course.trailer.embedUrl}
                title={`Trailer · ${course.title}`}
              />
            ) : course.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgSrc(course.coverUrl)}
                alt={course.title}
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-linear-to-br from-violet-500/20 to-fuchsia-500/10 text-violet-500/40">
                <GraduationCap className="size-16" />
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs uppercase text-muted-foreground">
              {hasMultiplePlans ? "A partir de" : "Investimento"}
            </span>
            <span className="text-2xl font-bold text-violet-700 dark:text-violet-300">
              {isFree ? "Grátis" : formatBrlCents(headlinePriceBrlCents)}
            </span>
          </div>
          <div className="mt-4">
            {enrolledInThisCourse ? (
              <Button
                size="lg"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => router.push(`/nasa-route/curso/${course.id}`)}
              >
                <CheckCircle2 className="mr-1.5 size-4" />
                Acessar curso
              </Button>
            ) : lessonsBased ? (
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
                  startEnrollment(
                    hasMultiplePlans ? null : (defaultPlan?.id ?? null),
                  )
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
          {enrolledInThisCourse && (
            <p className="mt-2 text-center text-[11px] text-emerald-600 dark:text-emerald-400">
              Você já tem acesso a este curso.
            </p>
          )}
          {!enrolledInThisCourse && !isAuthenticated && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {isFree
                ? "Crie sua conta em segundos"
                : lessonsBased
                  ? "Compra direta · sem precisar criar conta antes"
                  : "Faça login pra continuar"}
            </p>
          )}
          {!enrolledInThisCourse && isAuthenticated && !isFree && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Pagamento via Stripe · cartão de crédito
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
        // Aulas com `isFreePreview=true` — aparecem no card "Acesso
        // completo" com link direto pra assistir antes de comprar.
        // Inclui `thumbnailKey` pra a UI mostrar a capa de cada aula.
        freeLessons={course.lessons
          .filter((l) => l.isFreePreview)
          .map((l: any) => ({
            id: l.id,
            title: l.title,
            thumbnailKey: l.thumbnailKey ?? null,
          }))}
        freeLessonsBasePath={`/c/${companySlug}/${courseSlug}/preview`}
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
              Conclua todas as aulas e ganhe +{course.rewardSpOnComplete} Space
              Points de bônus!
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
            priceBrlCents: (course as any).priceBrlCents ?? 0,
            isFree: (course as any).isFree ?? false,
            creatorOrg: { name: org.name },
            plans: plans.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              priceStars: p.priceStars,
              priceBrlCents: p.priceBrlCents ?? 0,
              isDefault: p.isDefault,
              lessonCount: p.lessonCount,
              attachmentCount: p.attachments.length,
            })),
            // URL de redirect configurada em Integrações pelo criador.
            redirectUrl: (course as any).redirectUrl ?? null,
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
        />
      )}
    </div>
  );
}
