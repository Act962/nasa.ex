"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Award, ChevronRight, FileText, ListVideo, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { LessonListSidebar, orderLessonsForPlayer } from "./lesson-list-sidebar";
import { CourseCompletionCelebration } from "./course-completion-celebration";
import { CoursePlayerHeader } from "./course-player-header";
import { LessonPlayer } from "./lesson-player";
import { PlanAttachmentItem } from "./lesson-attachments";
import { NASA_ROUTE_MY_COURSES_HREF } from "../../hooks/use-nasa-route-dock";

interface Props {
  courseId: string;
  initialLessonId?: string;
}

export function CoursePlayerShell({ courseId, initialLessonId }: Props) {
  const queryClient = useQueryClient();
  const [activeLessonId, setActiveLessonId] = useState<string | null>(initialLessonId ?? null);
  const [isLessonsSheetOpen, setIsLessonsSheetOpen] = useState(false);
  const [celebration, setCelebration] = useState<{
    courseTitle: string;
    spAwarded: number;
    bonusSp: number;
    certificateCode: string | null;
  } | null>(null);

  const { data, isLoading, isError } = useQuery({
    ...orpc.nasaRoute.getCourseAsStudent.queryOptions({ input: { courseId } }),
  });

  const markComplete = useMutation({
    ...orpc.nasaRoute.markLessonComplete.mutationOptions(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.getCourseAsStudent.queryKey({ input: { courseId } }),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.listMyEnrollments.queryKey(),
      });

      if (result.lessonSpAwarded > 0) {
        toast.success(`+${result.lessonSpAwarded} Space Points!`, {
          description: "Aula concluída com sucesso.",
        });
      }

      if (result.isFullyComplete && result.courseRewards && data) {
        setCelebration({
          courseTitle: data.course.title,
          spAwarded: result.lessonSpAwarded,
          bonusSp: result.courseRewards.spAwarded,
          certificateCode: result.certificate?.code ?? null,
        });
      }
    },
    onError: (error) => {
      toast.error(error.message || "Não foi possível marcar a aula.");
    },
  });

  const completedSet = useMemo(
    () => new Set(data?.progress?.completedLessonIds ?? []),
    [data?.progress?.completedLessonIds],
  );

  const orderedLessons = useMemo(
    () => (data ? orderLessonsForPlayer(data.course.modules, data.course.lessons) : []),
    [data],
  );

  // Sem escolha do aluno, abre na última aula vista do plano ou na primeira ainda não concluída.
  const defaultLessonId = useMemo(() => {
    if (!data) return null;
    const planLessons = data.course.lessons.filter((lesson) => lesson.includedInPlan);
    const lastLessonId = data.progress?.lastLessonId;
    if (lastLessonId && planLessons.some((lesson) => lesson.id === lastLessonId)) return lastLessonId;
    const firstNotDone = planLessons.find((lesson) => !completedSet.has(lesson.id));
    return firstNotDone?.id ?? planLessons[0]?.id ?? data.course.lessons[0]?.id ?? null;
  }, [data, completedSet]);

  const resolvedLessonId = activeLessonId ?? defaultLessonId;
  const activeLesson = data
    ? (data.course.lessons.find((lesson) => lesson.id === resolvedLessonId) ?? data.course.lessons[0])
    : undefined;
  const activeLessonIndex = activeLesson
    ? orderedLessons.findIndex((lesson) => lesson.id === activeLesson.id)
    : -1;
  const nextLesson = activeLessonIndex >= 0 ? orderedLessons[activeLessonIndex + 1] : undefined;

  function selectLesson(lessonId: string) {
    setActiveLessonId(lessonId);
    setIsLessonsSheetOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToNextLesson() {
    if (nextLesson) {
      selectLesson(nextLesson.id);
      return;
    }
    toast("Esta é a última aula do curso.");
  }

  useRegisterOrbitDock({
    leftItems: [
      { label: "Meus cursos", icon: <PlayCircle />, href: NASA_ROUTE_MY_COURSES_HREF },
      { label: "Aulas", icon: <ListVideo />, onSelect: () => setIsLessonsSheetOpen(true), isActive: isLessonsSheetOpen },
    ],
    rightItems: [
      { label: "Próxima", icon: <ChevronRight />, onSelect: goToNextLesson },
      { label: "Certificados", icon: <Award />, href: "/nasa-route/certificados" },
    ],
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 md:py-8">
        <Skeleton className="aspect-video w-full rounded-[20px]" />
        <Skeleton className="h-6 w-48 md:w-64" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Curso indisponível</h1>
        <p className="mt-2 text-muted-foreground">Você precisa estar matriculado para acessar este curso.</p>
        <Button asChild variant="outline" className="mt-4 rounded-full">
          <Link href="/nasa-route">Voltar</Link>
        </Button>
      </div>
    );
  }

  const { course, progress, enrollment, plan } = data;
  const lessonsInPlan = course.lessons.filter((lesson) => lesson.includedInPlan);
  const completedCount = lessonsInPlan.filter((lesson) => completedSet.has(lesson.id)).length;

  const lessonList = (isInSheet: boolean) => (
    <LessonListSidebar
      modules={course.modules}
      lessons={course.lessons}
      activeLessonId={activeLesson?.id ?? null}
      completedSet={completedSet}
      onSelect={selectLesson}
      isInSheet={isInSheet}
    />
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-2 pb-[150px] md:pt-6 lg:py-8">
      <CoursePlayerHeader
        title={course.title}
        subtitle={course.subtitle}
        level={course.level}
        durationMin={course.durationMin}
        rewardSpOnComplete={course.rewardSpOnComplete}
        isFullyComplete={!!progress.completedAt}
        isFreeAccess={enrollment.source === "free_access"}
        planName={plan?.name ?? null}
        completedCount={completedCount}
        totalCount={lessonsInPlan.length}
      />

      <div className="mt-4 grid grid-cols-1 gap-6 lg:mt-8 lg:grid-cols-[300px_1fr]">
        <div className="max-lg:hidden">{lessonList(false)}</div>

        <section className="min-w-0 lg:rounded-[20px] lg:border lg:border-line lg:bg-card lg:p-6">
          {activeLesson ? (
            <LessonPlayer
              lesson={activeLesson}
              isCompleted={completedSet.has(activeLesson.id)}
              isLoading={markComplete.isPending}
              planName={plan?.name ?? null}
              onComplete={() => {
                // Fixa a aula atual para a tela não pular quando o progresso mudar.
                setActiveLessonId(activeLesson.id);
                markComplete.mutate({ courseId, lessonId: activeLesson.id });
              }}
              onOpenLessons={() => setIsLessonsSheetOpen(true)}
              onNextLesson={nextLesson ? goToNextLesson : undefined}
            />
          ) : (
            <div className="text-muted-foreground">Sem aulas disponíveis.</div>
          )}
        </section>
      </div>

      {plan && plan.attachments.length > 0 && (
        <section className="mt-6 lg:rounded-[20px] lg:border lg:border-line lg:bg-card lg:p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="size-5 text-info" />
            <h2 className="text-base font-semibold">Materiais do plano</h2>
            <span className="text-xs text-muted-foreground">
              · {plan.attachments.length} {plan.attachments.length === 1 ? "item" : "itens"}
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {plan.attachments.map((attachment) => (
              <li key={attachment.id}>
                <PlanAttachmentItem attachment={attachment} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet open={isLessonsSheetOpen} onOpenChange={setIsLessonsSheetOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[88dvh] flex-col gap-0 rounded-t-[26px] px-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="shrink-0 px-1 pb-0 text-left">
            <SheetTitle>Aulas do curso</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{lessonList(true)}</div>
        </SheetContent>
      </Sheet>

      {celebration && (
        <CourseCompletionCelebration {...celebration} onClose={() => setCelebration(null)} />
      )}
    </div>
  );
}
