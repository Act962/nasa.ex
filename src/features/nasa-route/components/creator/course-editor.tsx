"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { BookOpen, Info, Layers, Mail, Plug } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNasaRouteCreatorCourse } from "../../hooks/use-nasa-route-creator-course";
import { useNasaRouteCreatorDock } from "../../hooks/use-nasa-route-dock";
import { LessonForm, type LessonFormInitial } from "./lesson-form";
import { ModuleForm } from "./module-form";
import type { BoardModule } from "./lessons-board";
import { CourseEditorHeader } from "./course-editor-header";
import { CourseEditorTabContent, type EditorTab } from "./course-editor-tab-content";
import { DeleteCourseDialog, DeleteLessonDialog } from "./course-editor-delete-dialogs";

interface Props {
  courseId: string;
}

const EDITOR_TABS: { value: EditorTab; label: string; icon: typeof BookOpen }[] = [
  { value: "lessons", label: "Aulas e módulos", icon: BookOpen },
  { value: "plans", label: "Planos e entregas", icon: Layers },
  { value: "info", label: "Informações do curso", icon: Info },
  { value: "integrations", label: "Integrações", icon: Plug },
  { value: "purchase-email", label: "E-mail pós-compra", icon: Mail },
];

export function CourseEditor({ courseId }: Props) {
  useNasaRouteCreatorDock("courses");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<EditorTab>("lessons");
  const [editingLesson, setEditingLesson] = useState<LessonFormInitial | null>(null);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingModule, setEditingModule] = useState<BoardModule | null>(null);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lessonToDelete, setLessonToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const { data, isLoading } = useNasaRouteCreatorCourse(courseId);

  const publish = useMutation({
    ...orpc.nasaRoute.creatorPublishCourse.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({ input: { courseId } }),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorListCourses.queryKey(),
      });
    },
    onError: (error) => toast.error(error.message || "Falha ao publicar."),
  });

  const remove = useMutation({
    ...orpc.nasaRoute.creatorDeleteCourse.mutationOptions(),
    onSuccess: () => {
      toast.success("Curso excluído");
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorListCourses.queryKey(),
      });
      router.push("/nasa-route/criador");
    },
    onError: (error) => toast.error(error.message || "Falha ao excluir."),
  });

  const removeLesson = useMutation({
    ...orpc.nasaRoute.creatorDeleteLesson.mutationOptions(),
    onSuccess: () => {
      toast.success("Aula excluída");
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({ input: { courseId } }),
      });
      closeLessonDelete();
    },
    onError: (error) => toast.error(error.message || "Falha ao excluir a aula."),
  });

  function closeLessonDelete() {
    setLessonToDelete(null);
    setDeleteConfirmText("");
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 md:py-8">
        <Skeleton className="h-8 w-48 md:w-64" />
        <Skeleton className="h-64 w-full rounded-[20px]" />
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
    <div
      className="mx-auto w-full max-w-5xl px-4 pt-2 pb-[150px] md:py-8 lg:pb-10"
      style={{ scrollbarGutter: "stable" }}
    >
      <CourseEditorHeader
        course={course}
        isPublishPending={publish.isPending}
        onTogglePublish={() => publish.mutate({ courseId, isPublished: !course.isPublished })}
        onDelete={() => setConfirmDelete(true)}
      />

      <div className="scroll-hidden-x -mx-4 mt-4 overflow-x-auto px-4 md:mx-0 md:mt-6 md:px-0">
        <div className="flex w-max gap-1 rounded-full bg-panel p-1" role="tablist" aria-label="Seções do curso">
          {EDITOR_TABS.map((editorTab) => (
            <button
              key={editorTab.value}
              type="button"
              role="tab"
              aria-selected={tab === editorTab.value}
              onClick={() => setTab(editorTab.value)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition md:px-4",
                tab === editorTab.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <editorTab.icon className="size-3.5" />
              {editorTab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 min-h-[60vh] w-full md:mt-6">
        <CourseEditorTabContent
          tab={tab}
          course={course}
          onNewLesson={() => {
            setEditingLesson(null);
            setShowLessonForm(true);
          }}
          onNewModule={() => {
            setEditingModule(null);
            setShowModuleForm(true);
          }}
          onEditLesson={(lesson) => {
            // O board só tem a versão reduzida da aula; a edição precisa do objeto completo.
            const fullLesson = course.lessons.find((courseLesson) => courseLesson.id === lesson.id);
            setEditingLesson((fullLesson ?? lesson) as unknown as LessonFormInitial);
            setShowLessonForm(true);
          }}
          onDeleteLesson={(lesson) => {
            setLessonToDelete(lesson);
            setDeleteConfirmText("");
          }}
          onEditModule={(courseModule) => {
            setEditingModule(courseModule);
            setShowModuleForm(true);
          }}
        />
      </div>

      {showLessonForm && (
        <LessonForm
          open={showLessonForm}
          onClose={() => {
            setShowLessonForm(false);
            setEditingLesson(null);
          }}
          courseId={courseId}
          modules={course.modules.map((courseModule) => ({ id: courseModule.id, title: courseModule.title }))}
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

      <DeleteCourseDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={() => remove.mutate({ courseId })}
      />

      <DeleteLessonDialog
        lesson={lessonToDelete}
        confirmText={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
        isPending={removeLesson.isPending}
        onCancel={closeLessonDelete}
        onConfirm={() => {
          if (!lessonToDelete) return;
          removeLesson.mutate({ courseId, lessonId: lessonToDelete.id });
        }}
      />
    </div>
  );
}
