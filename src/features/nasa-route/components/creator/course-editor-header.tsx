"use client";

import Link from "next/link";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NasaRouteCreatorCourse } from "../../hooks/use-nasa-route-creator-course";
import { CourseShareMenu } from "../shared/course-share-menu";

interface CourseEditorHeaderProps {
  course: NasaRouteCreatorCourse;
  isPublishPending: boolean;
  onTogglePublish: () => void;
  onDelete: () => void;
}

const ROUND_ICON_BUTTON_CLASS =
  "size-10 gap-1.5 rounded-full border-0 bg-knob p-0 md:h-9 md:w-auto md:border md:bg-transparent md:px-4";

export function CourseEditorHeader({ course, isPublishPending, onTogglePublish, onDelete }: CourseEditorHeaderProps) {
  const publicHref = course.creatorOrg ? `/c/${course.creatorOrg.slug}/${course.slug}` : null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                course.isPublished ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
              )}
            >
              {course.isPublished ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
              {course.isPublished ? "Publicado" : "Rascunho"}
            </span>
            {course.creatorOrg && (
              <span className="truncate text-muted-foreground max-md:hidden">Por {course.creatorOrg.name}</span>
            )}
          </div>
          <h1 className="mt-1.5 line-clamp-2 text-xl leading-tight font-bold tracking-tight md:mt-2 md:truncate md:text-3xl">
            {course.title}
          </h1>
          <p className="text-xs text-muted-foreground md:text-sm">
            {course.lessons.length} aulas · {course.modules.length} módulos · {course.enrollmentCount} alunos
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {course.isPublished && publicHref && (
            <>
              <Button asChild variant="outline" className={ROUND_ICON_BUTTON_CLASS} title="Ver página pública">
                <Link href={publicHref} target="_blank" aria-label="Ver página pública">
                  <Eye className="size-4" />
                  <span className="max-md:sr-only">Ver pública</span>
                </Link>
              </Button>
              <span className="max-md:hidden">
                <CourseShareMenu
                  url={publicHref}
                  text={`${course.title} — confira na ÓRBITA Route`}
                  variant="button"
                  label="Compartilhar"
                />
              </span>
            </>
          )}
          <Button
            variant="outline"
            size="icon"
            className="size-10 rounded-full border-0 bg-knob md:size-9 md:border md:bg-transparent"
            onClick={onDelete}
            aria-label="Excluir curso"
            title="Excluir curso"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={course.isPublished ? "outline" : "default"}
          disabled={isPublishPending}
          onClick={onTogglePublish}
          className="h-11 flex-1 gap-1.5 rounded-full md:h-9 md:flex-none"
        >
          {course.isPublished ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {course.isPublished ? "Despublicar" : "Publicar"}
        </Button>
        {course.isPublished && publicHref && (
          <span className="md:hidden">
            <CourseShareMenu
              url={publicHref}
              text={`${course.title} — confira na ÓRBITA Route`}
              variant="button"
              label="Compartilhar"
            />
          </span>
        )}
      </div>
    </div>
  );
}
