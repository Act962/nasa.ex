"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  BookOpen,
  Gift,
  GraduationCap,
  LayoutGrid,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { AppReportButton } from "@/features/insights/components/app-report-button";
import { NasaRoutePageTop, TopActionLink } from "../shared/nasa-route-page-top";
import { useNasaRouteCreatorDock } from "../../hooks/use-nasa-route-dock";
import { CreatorCourseCard } from "./creator-course-card";

const CREATOR_NAV_LINKS = [
  { href: "/nasa-route/criador/vendas", label: "Vendas", icon: TrendingUp },
  { href: "/nasa-route/criador/alunos", label: "Alunos", icon: Users },
  { href: "/nasa-route/criador/acesso-livre", label: "Acesso livre", icon: Gift },
] as const;

export function CreatorDashboard() {
  useNasaRouteCreatorDock("courses");

  const { data, isLoading } = useQuery({
    ...orpc.nasaRoute.creatorListCourses.queryOptions(),
  });

  const courses = data?.courses ?? [];
  const publishedCount = courses.filter((course) => course.isPublished).length;
  const totalStudents = courses.reduce((total, course) => total + course.studentsCount, 0);
  const totalLessons = courses.reduce((total, course) => total + (course._count?.lessons ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-2 pb-[150px] md:py-8 lg:pb-10">
      <NasaRoutePageTop
        icon={<GraduationCap />}
        title="Painel do Criador"
        mobileTitle="Seus cursos"
        subtitle="Crie e gerencie seus cursos. Receba 90% do valor pago em STARs."
        mobileSubtitle="Receba 90% de cada venda em STARs"
        actions={
          <>
            <AppReportButton appModule="nasa-route" isCompactOnMobile />
            <TopActionLink href="/nasa-route" icon={<LayoutGrid className="size-4" />} label="Ver vitrine" />
          </>
        }
      />

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 md:mt-5">
        {CREATOR_NAV_LINKS.map((navLink) => (
          <Button key={navLink.href} asChild variant="outline" className="gap-1.5 max-lg:hidden">
            <Link href={navLink.href}>
              <navLink.icon className="size-4" />
              {navLink.label}
            </Link>
          </Button>
        ))}
        <Button
          asChild
          className="h-11 w-full gap-1.5 rounded-full md:h-9 md:w-auto"
          data-guide={GUIDE_ANCHORS.routeNewCourseButton.id}
        >
          <Link href="/nasa-route/criador/curso/novo">
            <Plus className="size-4" />
            Novo curso
          </Link>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:mt-6">
        <StatCard
          icon={<BookOpen className="size-4 text-info" />}
          label="Cursos"
          value={courses.length.toLocaleString("pt-BR")}
          sub={`${publishedCount} publicados`}
        />
        <StatCard
          icon={<Users className="size-4 text-success" />}
          label="Alunos"
          value={totalStudents.toLocaleString("pt-BR")}
          sub="total acumulado"
        />
        <StatCard
          icon={<TrendingUp className="size-4 text-warning" />}
          label="Aulas"
          value={totalLessons.toLocaleString("pt-BR")}
          sub="em todos os cursos"
          className="max-sm:col-span-2"
        />
      </div>

      <section className="mt-6 md:mt-8">
        <h2 className="text-lg font-bold md:text-xl">Seus cursos</h2>
        {isLoading ? (
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {[1, 2, 3].map((placeholderIndex) => (
              <Skeleton key={placeholderIndex} className="aspect-[4/5] rounded-[20px]" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="mt-3 rounded-[22px] border border-dashed border-line p-10 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
              <GraduationCap className="size-5 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium">Você ainda não criou nenhum curso</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Comece criando seu primeiro curso e ganhe STARs por aluno.
            </p>
            <Button asChild className="mt-4 rounded-full">
              <Link href="/nasa-route/criador/curso/novo">Criar primeiro curso</Link>
            </Button>
          </div>
        ) : (
          <div
            className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4"
            data-guide={GUIDE_ANCHORS.routeCourseList.id}
          >
            {courses.map((course) => {
              const pricedCourse = course as typeof course & {
                displayPriceBrlCents?: number | null;
                isFree?: boolean;
              };
              return (
                <CreatorCourseCard
                  key={course.id}
                  course={{
                    id: course.id,
                    title: course.title,
                    coverUrl: course.coverUrl,
                    format: course.format,
                    level: course.level,
                    isPublished: course.isPublished,
                    lessonsCount: course._count.lessons,
                    enrollmentsCount: course._count.enrollments,
                    displayPriceBrlCents: pricedCourse.displayPriceBrlCents ?? null,
                    isFree: pricedCourse.isFree ?? false,
                  }}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-[18px] border border-line bg-card p-3 md:rounded-[20px] md:p-5 ${className ?? ""}`}>
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground md:text-xs md:tracking-wider md:uppercase">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums md:mt-2 md:text-3xl">{value}</p>
      {sub && <p className="text-[12px] text-muted-foreground md:text-xs">{sub}</p>}
    </div>
  );
}
