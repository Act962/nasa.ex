"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Award, PenSquare, Search, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CoursePoster, type PosterCourse } from "../shared/course-poster";
import { CourseRow } from "../shared/course-row";
import { CourseHero } from "../shared/course-hero";
import { SearchPill } from "../shared/search-pill";
import { FilterPills } from "../shared/filter-pills";

const ALL_CATEGORIES_FILTER = "all";

/** Vitrine do aluno: busca, categorias em pílula, destaque e fileiras de cursos. */
export function NasaRouteCatalog() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES_FILTER);

  const { data: searchData, isLoading } = useQuery({
    ...orpc.nasaRoute.publicSearch.queryOptions({
      input: {
        query: query || undefined,
        categoryId: activeCategory === ALL_CATEGORIES_FILTER ? undefined : activeCategory,
      },
    }),
  });

  const { data: enrollmentsData } = useQuery({
    ...orpc.nasaRoute.listMyEnrollments.queryOptions(),
  });

  const courses = useMemo(() => searchData?.courses ?? [], [searchData?.courses]);
  const categories = searchData?.categories ?? [];
  const enrollments = useMemo(() => enrollmentsData?.enrollments ?? [], [enrollmentsData?.enrollments]);

  const inProgress = useMemo(
    () => enrollments.filter((enrollment) => !enrollment.completedAt && enrollment.progress.completed > 0),
    [enrollments],
  );
  const completedEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.completedAt),
    [enrollments],
  );

  const heroCourse = courses[0] ?? null;
  const trending = courses.slice(0, 12);
  const isSearching = !!query.trim() || activeCategory !== ALL_CATEGORIES_FILTER;

  const coursesByCategory = useMemo(() => {
    const groupsByCategoryId = new Map<string, { id: string; name: string; courses: typeof courses }>();
    for (const course of courses) {
      if (!course.category) continue;
      const existingGroup = groupsByCategoryId.get(course.category.id);
      if (existingGroup) {
        existingGroup.courses.push(course);
      } else {
        groupsByCategoryId.set(course.category.id, {
          id: course.category.id,
          name: course.category.name,
          courses: [course],
        });
      }
    }
    return Array.from(groupsByCategoryId.values()).filter((group) => group.courses.length >= 2);
  }, [courses]);

  const categoryOptions = [
    { value: ALL_CATEGORIES_FILTER, label: "Todos" },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
  ];

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="mx-auto mt-4 max-w-7xl space-y-3 px-4 md:mt-5 md:px-8">
        <SearchPill value={query} onChange={setQuery} placeholder="Buscar cursos, criadores, organizações…" />
        {categories.length > 0 && (
          <FilterPills
            options={categoryOptions}
            value={activeCategory}
            onChange={setActiveCategory}
            ariaLabel="Filtrar por categoria"
          />
        )}
      </div>

      {!isSearching && heroCourse && !isLoading && (
        <CourseHero
          course={heroCourse}
          href={`/c/${heroCourse.creatorOrg?.slug}/${heroCourse.slug}`}
          publicHref={`/c/${heroCourse.creatorOrg?.slug}/${heroCourse.slug}`}
        />
      )}

      {isLoading ? (
        <div className="px-4 md:px-8">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 md:flex md:overflow-hidden">
            {[1, 2, 3, 4, 5].map((placeholderIndex) => (
              <Skeleton key={placeholderIndex} className="aspect-video rounded-[18px] md:w-64 md:shrink-0" />
            ))}
          </div>
        </div>
      ) : courses.length === 0 ? (
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <div className="rounded-[22px] border border-dashed border-line p-10 text-center md:p-16">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
              <Search className="size-5 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium">Nenhum curso encontrado</p>
            <p className="mt-1 text-xs text-muted-foreground">Tente outras palavras ou remova os filtros.</p>
          </div>
        </div>
      ) : (
        <>
          {!isSearching && inProgress.length > 0 && (
            <CourseRow title="Continuar assistindo" subtitle="Onde você parou em seus cursos">
              {inProgress.map((enrollment) => {
                const lessonId = enrollment.progress.lastLessonId;
                const href = lessonId
                  ? `/nasa-route/curso/${enrollment.course.id}/aula/${lessonId}`
                  : `/nasa-route/curso/${enrollment.course.id}`;
                return <ContinueWatchingPoster key={enrollment.id} href={href} enrollment={enrollment} />;
              })}
            </CourseRow>
          )}

          <CourseRow
            title={isSearching ? "Resultados" : "Em alta no ÓRBITA Route"}
            subtitle={
              isSearching
                ? `${courses.length} ${courses.length === 1 ? "resultado" : "resultados"}`
                : "Os cursos mais populares agora"
            }
            isGridOnMobile
          >
            {trending.map((course) => (
              <CatalogPoster key={course.id} course={course} />
            ))}
          </CourseRow>

          {!isSearching &&
            coursesByCategory.map((group) => (
              <CourseRow key={group.id} title={group.name} subtitle="Categoria">
                {group.courses.map((course) => (
                  <CatalogPoster key={course.id} course={course} />
                ))}
              </CourseRow>
            ))}

          {!isSearching && completedEnrollments.length > 0 && (
            <CourseRow
              title="Cursos concluídos"
              subtitle="Conquiste seu certificado"
              rightSlot={
                <Button asChild variant="ghost" size="sm" className="gap-1.5 rounded-full">
                  <Link href="/nasa-route/certificados">
                    <Award className="size-4" />
                    <span className="max-md:sr-only">Ver certificados</span>
                  </Link>
                </Button>
              }
            >
              {completedEnrollments.map((enrollment) => (
                <ContinueWatchingPoster
                  key={enrollment.id}
                  href={`/nasa-route/curso/${enrollment.course.id}`}
                  enrollment={enrollment}
                />
              ))}
            </CourseRow>
          )}

          {!isSearching && <BecomeCreatorBanner />}
        </>
      )}
    </div>
  );
}

function BecomeCreatorBanner() {
  return (
    <div className="mx-auto mt-2 max-w-3xl px-4 md:px-8">
      <Link
        href="/nasa-route/criador"
        className="group flex flex-col gap-4 rounded-[24px] border border-info/30 bg-info/10 p-5 transition hover:border-info sm:flex-row sm:items-center sm:justify-between md:p-6"
      >
        <div className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-info text-white">
            <Sparkles className="size-6" />
          </div>
          <div>
            <p className="font-semibold">Crie seu próprio curso</p>
            <p className="text-xs text-muted-foreground">Compartilhe conhecimento e ganhe STARs com cada venda.</p>
          </div>
        </div>
        <span className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground sm:h-9">
          <PenSquare className="size-4" />
          Sou criador
        </span>
      </Link>
    </div>
  );
}

type SearchCourse = PosterCourse & {
  creatorOrg?: { slug?: string; name: string; logo?: string | null } | null;
};

function CatalogPoster({ course }: { course: SearchCourse }) {
  return (
    <CoursePoster
      href={`/c/${course.creatorOrg?.slug}/${course.slug}`}
      course={{
        ...course,
        creatorOrg: course.creatorOrg ? { name: course.creatorOrg.name, logo: course.creatorOrg.logo } : null,
      }}
    />
  );
}

interface EnrollmentLite {
  id: string;
  completedAt: Date | string | null;
  progress: {
    completed: number;
    total: number;
    pct: number;
    lastLessonId: string | null;
  };
  course: {
    id: string;
    title: string;
    subtitle?: string | null;
    coverUrl?: string | null;
    format: string;
    level: string;
    durationMin?: number | null;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
    eventStartsAt?: Date | string | null;
    eventEndsAt?: Date | string | null;
    priceBrlCents?: number | null;
    isFree?: boolean;
    creatorOrg?: { name: string; logo?: string | null } | null;
  };
}

function ContinueWatchingPoster({ href, enrollment }: { href: string; enrollment: EnrollmentLite }) {
  return (
    <CoursePoster
      href={href}
      progressPct={enrollment.progress.pct}
      completed={!!enrollment.completedAt}
      course={{
        id: enrollment.course.id,
        slug: "",
        title: enrollment.course.title,
        subtitle: enrollment.course.subtitle,
        coverUrl: enrollment.course.coverUrl,
        level: enrollment.course.level,
        durationMin: enrollment.course.durationMin,
        format: enrollment.course.format,
        startsAt: enrollment.course.startsAt,
        endsAt: enrollment.course.endsAt,
        eventStartsAt: enrollment.course.eventStartsAt,
        eventEndsAt: enrollment.course.eventEndsAt,
        priceBrlCents: enrollment.course.priceBrlCents,
        isFree: enrollment.course.isFree,
        creatorOrg: enrollment.course.creatorOrg,
      }}
    />
  );
}
