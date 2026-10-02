"use client";

import { FileTextIcon, LayoutDashboardIcon, LayoutTemplateIcon, MessageSquareTextIcon } from "lucide-react";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { CreateForm } from "./create-form";
import { FormList } from "./form-list";
import StatsCards from "./stats-card";
import { FormPatterns } from "./form-patterns";
import { RecentResponsesCarousel } from "./recent-responses-carousel";
import { AppReportButton } from "@/features/insights/components/app-report-button";

const SECTION_IDS = {
  dashboard: "forms-dashboard",
  patterns: "forms-patterns",
  responses: "forms-responses",
  allForms: "forms-all",
} as const;

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function FormPage() {
  // No celular o dock leva direto a cada parte da página.
  useRegisterOrbitDock({
    leftItems: [
      { label: "Painel", icon: <LayoutDashboardIcon />, onSelect: () => scrollToSection(SECTION_IDS.dashboard) },
      { label: "Padrões", icon: <LayoutTemplateIcon />, onSelect: () => scrollToSection(SECTION_IDS.patterns) },
    ],
    rightItems: [
      { label: "Respostas", icon: <MessageSquareTextIcon />, onSelect: () => scrollToSection(SECTION_IDS.responses) },
      { label: "Formulários", icon: <FileTextIcon />, onSelect: () => scrollToSection(SECTION_IDS.allForms) },
    ],
  });

  return (
    <div className="w-full space-y-8 px-4 md:px-0">
      <section id={SECTION_IDS.dashboard} className="w-full scroll-mt-16">
        <div className="flex w-full items-center justify-between gap-3 py-5">
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight sm:text-3xl">Formulários</h1>
          <div className="flex shrink-0 items-center gap-2">
            <AppReportButton appModule="forms" isCompactOnMobile />
            <CreateForm />
          </div>
        </div>
        <StatsCards />
      </section>
      <div id={SECTION_IDS.patterns} className="scroll-mt-16">
        <FormPatterns />
      </div>
      <div id={SECTION_IDS.responses} className="scroll-mt-16">
        <RecentResponsesCarousel />
      </div>
      <section id={SECTION_IDS.allForms} className="w-full scroll-mt-16 pb-10">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Todos os formulários</h2>
        <FormList />
      </section>
    </div>
  );
}
