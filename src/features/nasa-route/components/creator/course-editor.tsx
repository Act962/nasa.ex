"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Folder,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CourseForm } from "./course-form";
import { LessonForm } from "./lesson-form";
import { ModuleForm } from "./module-form";
import { PlansManager } from "./plans-manager";
import { IntegrationsTab } from "./integrations-tab";
import { LessonsBoard } from "./lessons-board";
import { CourseShareMenu } from "../shared/course-share-menu";
import { useRouter } from "next/navigation";

interface Props {
  courseId: string;
}

export function CourseEditor({ courseId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<
    "info" | "lessons" | "plans" | "integrations"
  >("lessons");
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingModule, setEditingModule] = useState<any>(null);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Delete de aula — exige digitar o título exato pra confirmar.
  const [lessonToDelete, setLessonToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const { data, isLoading } = useQuery({
    ...orpc.nasaRoute.creatorGetCourse.queryOptions({ input: { courseId } }),
  });

  const publish = useMutation({
    ...orpc.nasaRoute.creatorPublishCourse.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({ input: { courseId } }),
      });
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorListCourses.queryKey(),
      });
    },
    onError: (err: any) => toast.error(err?.message ?? "Falha ao publicar."),
  });

  const remove = useMutation({
    ...orpc.nasaRoute.creatorDeleteCourse.mutationOptions(),
    onSuccess: () => {
      toast.success("Curso excluído");
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorListCourses.queryKey(),
      });
      router.push("/nasa-route/criador");
    },
    onError: (err: any) => toast.error(err?.message ?? "Falha ao excluir."),
  });

  const removeLesson = useMutation({
    ...orpc.nasaRoute.creatorDeleteLesson.mutationOptions(),
    onSuccess: () => {
      toast.success("Aula excluída");
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({ input: { courseId } }),
      });
      setLessonToDelete(null);
      setDeleteConfirmText("");
    },
    onError: (err: any) => toast.error(err?.message ?? "Falha ao excluir a aula."),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Curso não encontrado</h1>
      </div>
    );
  }

  const { course } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/nasa-route/criador"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar para o painel
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={course.isPublished ? "default" : "secondary"}>
              {course.isPublished ? (
                <>
                  <Eye className="mr-1 size-3" />
                  Publicado
                </>
              ) : (
                <>
                  <EyeOff className="mr-1 size-3" />
                  Rascunho
                </>
              )}
            </Badge>
            {course.creatorOrg && (
              <span className="text-xs text-muted-foreground">
                Por {course.creatorOrg.name}
              </span>
            )}
          </div>
          <h1 className="mt-2 truncate text-3xl font-bold tracking-tight">
            {course.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {course.lessons.length} aulas · {course.modules.length} módulos ·{" "}
            {course.enrollmentCount} alunos
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {course.isPublished && course.creatorOrg && (
            <>
              <Button asChild variant="outline" className="gap-1.5">
                <Link
                  href={`/c/${course.creatorOrg.slug}/${course.slug}`}
                  target="_blank"
                >
                  <Eye className="size-4" />
                  Ver pública
                </Link>
              </Button>
              <CourseShareMenu
                url={`/c/${course.creatorOrg.slug}/${course.slug}`}
                text={`${course.title} — confira na NASA Route`}
                variant="button"
                label="Compartilhar"
              />
            </>
          )}
          <Button
            variant={course.isPublished ? "outline" : "default"}
            disabled={publish.isPending}
            onClick={() =>
              publish.mutate({ courseId, isPublished: !course.isPublished })
            }
            className="gap-1.5"
          >
            {course.isPublished ? (
              <>
                <EyeOff className="size-4" />
                Despublicar
              </>
            ) : (
              <>
                <Eye className="size-4" />
                Publicar
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4 text-rose-600" />
          </Button>
        </div>
      </div>

      <div className="mt-6 flex border-b border-border">
        <button
          type="button"
          onClick={() => setTab("lessons")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "lessons"
              ? "border-violet-600 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Aulas e módulos
        </button>
        <button
          type="button"
          onClick={() => setTab("plans")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "plans"
              ? "border-violet-600 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Planos e entregas
        </button>
        <button
          type="button"
          onClick={() => setTab("info")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "info"
              ? "border-violet-600 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Informações do curso
        </button>
        <button
          type="button"
          onClick={() => setTab("integrations")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "integrations"
              ? "border-violet-600 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Integrações
        </button>
      </div>

      <div className="mt-6">
        {tab === "info" ? (
          <CourseForm
            courseId={course.id}
            initial={{
              id: course.id,
              slug: course.slug,
              title: course.title,
              subtitle: course.subtitle,
              description: course.description,
              coverUrl: course.coverUrl,
              trailerUrl: course.trailerUrl,
              level: course.level,
              format: course.format,
              durationMin: course.durationMin,
              priceStars: course.priceStars,
              categoryId: course.categoryId,
              rewardSpOnComplete: course.rewardSpOnComplete,
              // Datas unificadas (todos os formatos podem ter)
              startsAt: (course as any).startsAt ?? null,
              endsAt: (course as any).endsAt ?? null,
              // Legado evento (preservado pra compat)
              eventStartsAt: (course as any).eventStartsAt ?? null,
              eventEndsAt: (course as any).eventEndsAt ?? null,
              // Funil pós-compra (tracking + status)
              purchaseTrackingId:
                (course as any).purchaseTrackingId ?? null,
              purchaseStatusId: (course as any).purchaseStatusId ?? null,
            }}
          />
        ) : tab === "plans" ? (
          <PlansManager
            courseId={course.id}
            lessons={course.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              moduleId: l.moduleId,
              order: l.order,
            }))}
            modules={course.modules.map((m) => ({ id: m.id, title: m.title }))}
          />
        ) : tab === "integrations" ? (
          course.creatorOrg && (
            <IntegrationsTab
              courseId={course.id}
              companySlug={course.creatorOrg.slug}
              courseSlug={course.slug}
              initial={{
                slug: course.slug,
                title: course.title,
                subtitle: course.subtitle,
                description: course.description,
                coverUrl: course.coverUrl,
                trailerUrl: course.trailerUrl,
                level: course.level,
                format: course.format,
                durationMin: course.durationMin,
                priceStars: course.priceStars,
                categoryId: course.categoryId,
                rewardSpOnComplete: course.rewardSpOnComplete,
                redirectUrl: (course as any).redirectUrl ?? null,
                pixelId: (course as any).pixelId ?? null,
                gtmId: (course as any).gtmId ?? null,
              }}
            />
          )
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setEditingLesson(null);
                  setShowLessonForm(true);
                }}
                className="gap-1.5"
              >
                <Plus className="size-4" />
                Nova aula
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingModule(null);
                  setShowModuleForm(true);
                }}
                className="gap-1.5"
              >
                <Folder className="size-4" />
                Novo módulo
              </Button>
            </div>

            <LessonsBoard
              courseId={courseId}
              modules={course.modules.map((m) => ({
                id: m.id,
                title: m.title,
                summary: m.summary,
                order: m.order,
              }))}
              lessons={course.lessons.map((l: any) => ({
                id: l.id,
                title: l.title,
                moduleId: l.moduleId,
                order: l.order,
                thumbnailKey: l.thumbnailKey,
                isFreePreview: l.isFreePreview,
                durationMin: l.durationMin,
                awardSp: l.awardSp,
                video: { provider: l.video?.provider ?? null },
              }))}
              onEditLesson={(lesson) => {
                // O board passa apenas a versão reduzida da aula. Pra editar
                // precisamos do objeto completo (com summary/contentMd/videoUrl/
                // attachments/videoFileKey etc.) — recupera do payload original.
                const full = course.lessons.find((l) => l.id === lesson.id);
                setEditingLesson(full ?? lesson);
                setShowLessonForm(true);
              }}
              onDeleteLesson={(l) => {
                setLessonToDelete(l);
                setDeleteConfirmText("");
              }}
              onEditModule={(m) => {
                setEditingModule(m);
                setShowModuleForm(true);
              }}
            />

          </div>
        )}
      </div>

      {showLessonForm && (
        <LessonForm
          open={showLessonForm}
          onClose={() => {
            setShowLessonForm(false);
            setEditingLesson(null);
          }}
          courseId={courseId}
          modules={course.modules.map((m) => ({ id: m.id, title: m.title }))}
          initial={editingLesson ?? undefined}
        />
      )}

      {showModuleForm && (
        <ModuleForm
          open={showModuleForm}
          onClose={() => {
            setShowModuleForm(false);
            setEditingModule(null);
          }}
          courseId={courseId}
          initial={editingModule ?? undefined}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir curso?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todas as aulas, módulos, matrículas e
              progresso serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove.mutate({ courseId })}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete de aula — exige digitar o título da aula pra confirmar.
          Padrão "type-to-confirm" do GitHub. Evita delete acidental: o
          botão fica desabilitado até `deleteConfirmText === title`. */}
      <AlertDialog
        open={!!lessonToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setLessonToDelete(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              ⚠️ Excluir aula permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Esta ação é <strong>irreversível</strong>. O vídeo hospedado,
                progresso dos alunos e vínculos com planos serão removidos.
              </span>
              <span className="block">
                Pra confirmar, digite o nome exato da aula:
              </span>
              <span className="block rounded bg-muted px-2 py-1 font-mono text-sm">
                {lessonToDelete?.title}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="delete-lesson-confirm" className="text-xs">
              Nome da aula
            </Label>
            <Input
              id="delete-lesson-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Digite o nome exato"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeLesson.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                removeLesson.isPending ||
                deleteConfirmText !== lessonToDelete?.title
              }
              onClick={() => {
                if (!lessonToDelete) return;
                removeLesson.mutate({
                  courseId,
                  lessonId: lessonToDelete.id,
                });
              }}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {removeLesson.isPending ? "Excluindo..." : "Sim, excluir aula"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

