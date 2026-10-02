"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { BookOpen, CheckCircle2, CreditCard, Sparkles, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NasaRoutePageTop } from "../shared/nasa-route-page-top";
import { FilterPills } from "../shared/filter-pills";
import { useNasaRouteCreatorDock } from "../../hooks/use-nasa-route-dock";
import {
  type StudentEnrollment,
  type StudentGroup,
  formatBrlCents,
  getPaymentKind,
} from "./students-shared";
import { StudentsGroupedView } from "./students-grouped-view";
import { StudentsEnrollmentsList } from "./students-enrollments-list";

type StudentsView = "matriculas" | "alunos";

const ALL_COURSES_FILTER = "all";

export function StudentsTable() {
  useNasaRouteCreatorDock("students");
  const [courseFilter, setCourseFilter] = useState<string>(ALL_COURSES_FILTER);
  const [view, setView] = useState<StudentsView>("alunos");

  const { data: coursesData } = useQuery({
    ...orpc.nasaRoute.creatorListCourses.queryOptions(),
  });

  const { data, isLoading } = useQuery({
    ...orpc.nasaRoute.creatorListStudents.queryOptions({
      input: courseFilter === ALL_COURSES_FILTER ? {} : { courseId: courseFilter },
    }),
  });

  const enrollments = useMemo(() => (data?.enrollments ?? []) as StudentEnrollment[], [data?.enrollments]);

  const stats = useMemo(() => {
    const completed = enrollments.filter((enrollment) => enrollment.completedAt).length;
    const brlGross = enrollments.reduce((total, enrollment) => total + (enrollment.paidBrlCents ?? 0), 0);
    const starsPayout = enrollments.reduce(
      (total, enrollment) => total + Math.floor(enrollment.paidStars * 0.9),
      0,
    );
    const stripeCount = enrollments.filter((enrollment) => getPaymentKind(enrollment) === "stripe").length;
    const uniqueStudents = new Set(enrollments.map((enrollment) => enrollment.user.id)).size;
    return { completed, brlGross, starsPayout, stripeCount, uniqueStudents };
  }, [enrollments]);

  const groupedByStudent = useMemo(() => {
    const groupsByUserId = new Map<string, StudentGroup>();
    for (const enrollment of enrollments) {
      const existingGroup = groupsByUserId.get(enrollment.user.id);
      const enrolledAt = new Date(enrollment.enrolledAt);
      if (existingGroup) {
        existingGroup.enrollments.push(enrollment);
        if (enrolledAt > existingGroup.latest) existingGroup.latest = enrolledAt;
      } else {
        groupsByUserId.set(enrollment.user.id, {
          user: enrollment.user,
          enrollments: [enrollment],
          latest: enrolledAt,
        });
      }
    }
    return Array.from(groupsByUserId.values()).sort(
      (first, second) => second.latest.getTime() - first.latest.getTime(),
    );
  }, [enrollments]);

  const courseOptions = useMemo(
    () => [
      { value: ALL_COURSES_FILTER, label: "Todos os cursos" },
      ...(coursesData?.courses ?? []).map((course) => ({ value: course.id, label: course.title })),
    ],
    [coursesData?.courses],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-2 pb-[150px] md:py-8 lg:pb-10">
      <NasaRoutePageTop
        icon={<Users />}
        title="Alunos"
        subtitle="Veja quem está matriculado, como entrou e o que está acessando."
        mobileSubtitle="Quem entrou e como"
      />

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:mt-6 lg:grid-cols-5">
        <Stat label="Alunos únicos" value={stats.uniqueStudents} icon={<Users className="size-4 text-info" />} />
        <Stat label="Matrículas" value={enrollments.length} icon={<BookOpen className="size-4 text-info" />} />
        <Stat label="Concluídos" value={stats.completed} icon={<CheckCircle2 className="size-4 text-success" />} />
        <Stat
          label="Faturamento Stripe"
          value={formatBrlCents(stats.brlGross)}
          icon={<CreditCard className="size-4 text-info" />}
          subtitle={`${stats.stripeCount} ${stats.stripeCount === 1 ? "venda" : "vendas"}`}
        />
        <Stat
          label="Repasse em Stars (90%)"
          value={`${stats.starsPayout.toLocaleString("pt-BR")} ★`}
          icon={<Sparkles className="size-4 text-warning" />}
          className="max-sm:col-span-2"
        />
      </div>

      <div className="mt-5 space-y-3 md:mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={view} onValueChange={(nextView) => setView(nextView as StudentsView)} className="max-md:w-full">
            <TabsList className="h-10 w-full md:w-auto">
              <TabsTrigger value="alunos" className="flex-1 md:flex-none">Por aluno</TabsTrigger>
              <TabsTrigger value="matriculas" className="flex-1 md:flex-none">Por matrícula</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {courseOptions.length > 2 && (
          <FilterPills
            options={courseOptions}
            value={courseFilter}
            onChange={setCourseFilter}
            ariaLabel="Filtrar por curso"
          />
        )}
      </div>

      <div className="mt-3 md:mt-4">
        {view === "alunos" ? (
          <StudentsGroupedView groups={groupedByStudent} isLoading={isLoading} />
        ) : (
          <StudentsEnrollmentsList enrollments={enrollments} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  subtitle,
  className,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-[18px] border border-line bg-card p-3 md:rounded-[20px] md:p-4 ${className ?? ""}`}>
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground md:text-[11px] md:tracking-wider md:uppercase">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 truncate text-lg font-bold tabular-nums md:mt-2 md:text-xl">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
      {subtitle && <p className="mt-0.5 text-[12px] text-muted-foreground md:text-[11px]">{subtitle}</p>}
    </div>
  );
}
