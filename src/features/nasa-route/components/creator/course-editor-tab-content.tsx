"use client";

import { Folder, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import type { NasaRouteCreatorCourse } from "../../hooks/use-nasa-route-creator-course";
import { CourseForm } from "./course-form";
import { PlansManager } from "./plans-manager";
import { IntegrationsTab } from "./integrations-tab";
import { PurchaseEmailTab } from "./purchase-email-tab";
import { LessonsBoard, type BoardLesson, type BoardModule } from "./lessons-board";

export type EditorTab = "info" | "lessons" | "plans" | "integrations" | "purchase-email";

interface CourseEditorTabContentProps {
  tab: EditorTab;
  course: NasaRouteCreatorCourse;
  onNewLesson: () => void;
  onNewModule: () => void;
  onEditLesson: (lesson: BoardLesson) => void;
  onDeleteLesson: (lesson: { id: string; title: string }) => void;
  onEditModule: (module: BoardModule) => void;
}

export function CourseEditorTabContent({
  tab,
  course,
  onNewLesson,
  onNewModule,
  onEditLesson,
  onDeleteLesson,
  onEditModule,
}: CourseEditorTabContentProps) {
  const baseInitial = {
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
  };

  const trackingInitial = {
    redirectUrl: course.redirectUrl ?? null,
    pixelId: course.pixelId ?? null,
    gtmId: course.gtmId ?? null,
  };

  if (tab === "info") {
    return (
      <CourseForm
        courseId={course.id}
        initial={{
          id: course.id,
          ...baseInitial,
          startsAt: course.startsAt ?? null,
          endsAt: course.endsAt ?? null,
          eventStartsAt: course.eventStartsAt ?? null,
          eventEndsAt: course.eventEndsAt ?? null,
          purchaseTrackingId: course.purchaseTrackingId ?? null,
          purchaseStatusId: course.purchaseStatusId ?? null,
        }}
      />
    );
  }

  if (tab === "plans") {
    return (
      <PlansManager
        courseId={course.id}
        lessons={course.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          moduleId: lesson.moduleId,
          order: lesson.order,
        }))}
        modules={course.modules.map((courseModule) => ({ id: courseModule.id, title: courseModule.title }))}
      />
    );
  }

  if (tab === "integrations") {
    if (!course.creatorOrg) return null;
    return (
      <IntegrationsTab
        courseId={course.id}
        companySlug={course.creatorOrg.slug}
        courseSlug={course.slug}
        initial={{ ...baseInitial, ...trackingInitial }}
      />
    );
  }

  if (tab === "purchase-email") {
    return (
      <PurchaseEmailTab
        courseId={course.id}
        initial={{
          ...baseInitial,
          ...trackingInitial,
          purchaseEmailEnabled: course.purchaseEmailEnabled ?? false,
          purchaseEmailSubject: course.purchaseEmailSubject ?? null,
          purchaseEmailBodyJson: course.purchaseEmailBodyJson ?? null,
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
        <Button
          data-guide={GUIDE_ANCHORS.routeNewLessonButton.id}
          onClick={onNewLesson}
          className="h-11 gap-1.5 rounded-full md:h-9"
        >
          <Plus className="size-4" />
          Nova aula
        </Button>
        <Button variant="outline" onClick={onNewModule} className="h-11 gap-1.5 rounded-full md:h-9">
          <Folder className="size-4" />
          Novo módulo
        </Button>
      </div>

      <LessonsBoard
        courseId={course.id}
        modules={course.modules.map((courseModule) => ({
          id: courseModule.id,
          title: courseModule.title,
          summary: courseModule.summary,
          order: courseModule.order,
        }))}
        lessons={course.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          moduleId: lesson.moduleId,
          order: lesson.order,
          thumbnailKey: lesson.thumbnailKey,
          isFreePreview: lesson.isFreePreview,
          durationMin: lesson.durationMin,
          awardSp: lesson.awardSp,
          video: { provider: lesson.video?.provider ?? null },
        }))}
        onEditLesson={onEditLesson}
        onDeleteLesson={onDeleteLesson}
        onEditModule={onEditModule}
      />
    </div>
  );
}
