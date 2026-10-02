"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Skeleton } from "@/components/ui/skeleton";
import { hasLessons } from "@/features/nasa-route/lib/formats";
import { CoursePlayerShell } from "../course-player-shell";
import { EbookViewer } from "./ebook-viewer";
import { EventViewer } from "./event-viewer";
import { CommunityViewer } from "./community-viewer";
import { SubscriptionViewer } from "./subscription-viewer";
import { StudentDockRegistrar } from "../../shared/student-dock-registrar";

interface Props {
  courseId: string;
}

/**
 * Roteador de viewers do aluno: carrega o curso uma vez, depois decide
 * qual componente renderizar com base em `course.format`.
 *
 * - Formatos com aulas (`course/training/mentoring`) → CoursePlayerShell.
 * - eBook → EbookViewer.
 * - Evento → EventViewer.
 * - Comunidade → CommunityViewer.
 * - Assinatura → SubscriptionViewer.
 *
 * O `getCourseAsStudent` já valida matrícula ativa, então qualquer viewer
 * abaixo já pode confiar que o aluno tem acesso.
 */
export function CourseRouteViewer({ courseId }: Props) {
  const { data, isLoading, isError, error } = useQuery({
    ...orpc.nasaRoute.getCourseAsStudent.queryOptions({ input: { courseId } }),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Não foi possível carregar este produto</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {(error as { message?: string } | null)?.message ??
            "Verifique sua matrícula ou tente novamente."}
        </p>
      </div>
    );
  }

  const { course } = data;

  // Formatos com aulas → player atual
  if (hasLessons(course.format)) {
    return <CoursePlayerShell courseId={courseId} />;
  }

  // Demais formatos → viewer específico
  switch (course.format) {
    case "ebook":
      return (
        <>
          <StudentDockRegistrar activeSection="my-courses" />
          <div className="pb-[150px] lg:pb-0"><EbookViewer course={course as any} /></div>
        </>
      );
    case "event":
      return (
        <>
          <StudentDockRegistrar activeSection="my-courses" />
          <div className="pb-[150px] lg:pb-0"><EventViewer course={course as any} /></div>
        </>
      );
    case "community":
      return (
        <>
          <StudentDockRegistrar activeSection="my-courses" />
          <div className="pb-[150px] lg:pb-0"><CommunityViewer course={course as any} /></div>
        </>
      );
    case "subscription":
      return (
        <>
          <StudentDockRegistrar activeSection="my-courses" />
          <div className="pb-[150px] lg:pb-0"><SubscriptionViewer course={course as any} /></div>
        </>
      );
    default:
      // Fallback: formato desconhecido cai no player (não deve acontecer)
      return <CoursePlayerShell courseId={courseId} />;
  }
}
