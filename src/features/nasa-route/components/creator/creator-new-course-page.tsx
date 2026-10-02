"use client";

import { Plus } from "lucide-react";
import { CourseForm } from "./course-form";
import { NasaRoutePageTop } from "../shared/nasa-route-page-top";

export function CreatorNewCoursePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-6 md:py-8">
      <NasaRoutePageTop
        icon={<Plus />}
        title="Novo curso"
        subtitle="Preencha as informações básicas. Você poderá adicionar aulas e módulos depois."
        mobileSubtitle="Comece pelo básico; aulas vêm depois"
      />
      <div className="mt-5 md:mt-8">
        <CourseForm />
      </div>
    </div>
  );
}
