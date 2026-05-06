"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Award,
  GraduationCap,
  PenSquare,
  Search,
  Sparkles,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CoursePoster } from "../shared/course-poster";
import { CourseRow } from "../shared/course-row";
import { CourseHero } from "../shared/course-hero";

export function NasaRouteHome() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: searchData, isLoading } = useQuery({
    ...orpc.nasaRoute.publicSearch.queryOptions({
      input: { query: query || undefined, categoryId: activeCategory ?? undefined },
    }),
  });

  const { data: enrollmentsData } = useQuery({
    ...orpc.nasaRoute.listMyEnrollments.queryOptions(),
  });

  const courses = searchData?.courses ?? [];
  const categories = searchData?.categories ?? [];
  const enrollments = enrollmentsData?.enrollments ?? [];

  const inProgress = useMemo(
    () => enrollments.filter((e) => !e.completedAt && e.progress.completed > 0),
    [enrollments],
  );

  const heroCourse = courses[0] ?? null;
  const trending = courses.slice(0, 12);
  const isSearching = !!query.trim() || !!activeCategory;

  const byCategory = useMemo(() => {
    const map = new Map<string, { id: string; name: string; courses: typeof courses }>();
    for (const c of courses) {
      if (!c.category) continue;
      const existing = map.get(c.category.id);
      if (existing) {
        existing.courses.push(c);
      } else {
        map.set(c.category.id, {
          id: c.category.id,
          name: c.category.name,
          courses: [c],
        });
      }
    }
    return Array.from(map.values()).filter((g) => g.courses.length >= 2);
  }, [courses]);

  return (
    <div className="w-full flex-1 space-y-10 pb-16">
      {!isSearching && heroCourse && !isLoading && (
        <CourseHero
          course={heroCourse}
          href={`/c/${heroCourse.creatorOrg?.slug}/${heroCourse.slug}`}
          publicHref={`/c/${heroCourse.creatorOrg?.slug}/${heroCourse.slug}`}
        />
      )}

      <div className="px-4 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 px-3 py-2 text-white shadow-md">
            <GraduationCap className="size-5" />
            <span className="text-sm font-semibold">NASA Route</span>
          </div>
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cursos, criadores, organizações…"
              className="pl-9"
            />
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/nasa-route/certificados">
              <Award className="size-4" />
              Meus certificados
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/nasa-route/criador">
              <PenSquare className="size-4" />
              Sou criador
            </Link>
          </Button>
        </div>

        {categories.length > 0 && (
          <div className="mx-auto mt-5 flex max-w-7xl flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                activeCategory === null
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              Todos
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  activeCategory === c.id
                    ? "border-violet-600 bg-violet-600 text-white"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="px-4 md:px-8">
          <div className="mx-auto flex max-w-7xl gap-3 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="aspect-video w-64 shrink-0 rounded-xl" />
            ))}
          </div>
        </div>
      ) : courses.length === 0 ? (
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-16 text-center">
            <Search className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Nenhum curso encontrado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tente outras palavras-chave ou remova os filtros.
            </p>
          </div>
        </div>
      ) : (
        <>
          {!isSearching && inProgress.length > 0 && (
            <CourseRow
              title="Continuar assistindo"
              subtitle="Onde você parou em seus cursos"
            >
              {inProgress.map((e) => {
                const lessonId = e.progress.lastLessonId;
                const href = lessonId
                  ? `/nasa-route/curso/${e.course.id}/aula/${lessonId}`
                  : `/nasa-route/curso/${e.course.id}`;
                return (
                  <ContinueWatchingPoster key={e.id} href={href} enrollment={e} />
                );
              })}
            </CourseRow>
          )}

          <CourseRow
            title={isSearching ? "Resultados" : "Em alta no NASA Route"}
            subtitle={
              isSearching
                ? `${courses.length} ${courses.length === 1 ? "resultado" : "resultados"}`
                : "Os cursos mais populares agora"
            }
          >
            {trending.map((c) => (
              <CoursePoster
                key={c.id}
                href={`/c/${c.creatorOrg?.slug}/${c.slug}`}
                course={{
                  ...c,
                  creatorOrg: c.creatorOrg
                    ? { name: c.creatorOrg.name, logo: c.creatorOrg.logo }
                    : null,
                }}
              />
            ))}
          </CourseRow>

          {!isSearching &&
            byCategory.map((g) => (
              <CourseRow key={g.id} title={g.name} subtitle="Categoria">
                {g.courses.map((c) => (
                  <CoursePoster
                    key={c.id}
                    href={`/c/${c.creatorOrg?.slug}/${c.slug}`}
                    course={{
                      ...c,
                      creatorOrg: c.creatorOrg
                        ? { name: c.creatorOrg.name, logo: c.creatorOrg.logo }
                        : null,
                    }}
                  />
                ))}
              </CourseRow>
            ))}

          {!isSearching && enrollments.filter((e) => e.completedAt).length > 0 && (
            <CourseRow
              title="Cursos concluídos"
              subtitle="Conquiste seu certificado"
              rightSlot={
                <Button asChild variant="ghost" size="sm" className="gap-1.5">
                  <Link href="/nasa-route/certificados">
                    <Award className="size-4" />
                    Ver certificados
                  </Link>
                </Button>
              }
            >
              {enrollments
                .filter((e) => e.completedAt)
                .map((e) => (
                  <ContinueWatchingPoster
                    key={e.id}
                    href={`/nasa-route/curso/${e.course.id}`}
                    enrollment={e}
                  />
                ))}
            </CourseRow>
          )}

          {!isSearching && (
            <div className="mx-auto mt-2 max-w-3xl px-4 md:px-8">
              <Link
                href="/nasa-route/criador"
                className="group flex items-center justify-between rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-600/10 via-fuchsia-500/10 to-indigo-500/10 p-6 transition hover:border-violet-400 dark:border-violet-800/40"
              >
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white">
                    <Sparkles className="size-6" />
                  </div>
                  <div>
                    <p className="font-semibold">Crie seu próprio curso</p>
                    <p className="text-xs text-muted-foreground">
                      Compartilhe conhecimento e ganhe STARs com cada venda.
                    </p>
                  </div>
                </div>
                <Button variant="default" size="sm" className="gap-1.5">
                  <PenSquare className="size-4" />
                  Sou criador
                </Button>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface EnrollmentLite {
  id: string;
  source: string;
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
    creatorOrg?: { name: string; logo?: string | null } | null;
  };
}

function ContinueWatchingPoster({
  href,
  enrollment,
}: {
  href: string;
  enrollment: EnrollmentLite;
}) {
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
        priceStars: 0,
        creatorOrg: enrollment.course.creatorOrg,
      }}
    />
  );
}
