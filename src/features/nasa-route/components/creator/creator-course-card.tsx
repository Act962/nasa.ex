"use client";

import Link from "next/link";
import { Eye, EyeOff, GraduationCap, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import { COURSE_FORMAT_LABELS, COURSE_LEVEL_LABELS } from "../../types";
import { PriceStarsDisplay } from "../shared/price-stars-display";

export interface CreatorCourseCardData {
  id: string;
  title: string;
  coverUrl: string | null;
  format: string;
  level: string;
  isPublished: boolean;
  lessonsCount: number;
  enrollmentsCount: number;
  displayPriceBrlCents: number | null;
  isFree: boolean;
}

/** Cartão do curso no painel do criador: capa em cima, essencial embaixo (grade de 2 no celular). */
export function CreatorCourseCard({ course }: { course: CreatorCourseCardData }) {
  return (
    <Link
      href={`/nasa-route/criador/curso/${course.id}/editar`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-line bg-card transition hover:shadow-sm"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-info/15">
        {course.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc(course.coverUrl)}
            alt={course.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-info/40">
            <GraduationCap className="size-8" />
          </div>
        )}
        <span
          className={cn(
            "absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm",
            course.isPublished ? "bg-foreground/85 text-background" : "bg-background/85 text-foreground",
          )}
        >
          {course.isPublished ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          {course.isPublished ? "Publicado" : "Rascunho"}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 md:p-4">
        <p className="truncate text-[11px] text-muted-foreground">
          {COURSE_FORMAT_LABELS[course.format] ?? course.format}
          <span className="max-md:hidden"> · {COURSE_LEVEL_LABELS[course.level] ?? course.level}</span>
        </p>
        <h3 className="line-clamp-2 text-sm leading-tight font-semibold md:text-base">{course.title}</h3>
        <p className="text-[11px] text-muted-foreground md:text-xs">
          {course.lessonsCount} aulas · {course.enrollmentsCount} alunos
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <PriceStarsDisplay
            priceBrlCents={course.displayPriceBrlCents}
            isFree={course.isFree}
            size="sm"
          />
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-knob text-muted-foreground">
            <Pencil className="size-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
