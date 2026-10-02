"use client";
import React, { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useBuilderStore } from "../../context/builder-form-provider";
import { Builder } from "@/features/form/components/build/builder";
import { BuilderDragOverlay } from "@/features/form/components/common/utils/builder-drag-overlay";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileFormBuilder } from "./mobile/mobile-form-builder";
import { useApplyStarterTemplate } from "./starter-template-picker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

import { useEffect } from "react";

export function FormBuilder({ formId }: { formId: string }) {
  const { formData, fetchFormById, loading, blockLayouts } = useBuilderStore();
  const isPublished = formData?.published;

  useEffect(() => {
    if (formId) {
      fetchFormById(formId);
    }
  }, [formId, fetchFormById]);

  // Veio de "Padrões" (?template=…): aplica o modelo uma vez, no formulário recém-criado e vazio.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const applyStarterTemplate = useApplyStarterTemplate();
  const appliedTemplateRef = useRef(false);
  const requestedTemplateId = searchParams.get("template");
  useEffect(() => {
    if (!requestedTemplateId || appliedTemplateRef.current) return;
    if (loading || formData?.id !== formId) return;
    appliedTemplateRef.current = true;
    if (blockLayouts.length === 0) applyStarterTemplate(requestedTemplateId);
    router.replace(pathname);
  }, [requestedTemplateId, loading, formData?.id, formId, blockLayouts.length, applyStarterTemplate, router, pathname]);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 500,
      tolerance: 10,
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  const [isSidebarOpen, setIsSidebarOpen] = useState(
    isPublished ? false : true,
  );
  const isMobile = useIsMobile();

  // Celular: tela cheia, dock com "+ Bloco" e gavetas — a barra lateral e o painel fixo não cabem.
  if (isMobile) {
    return (
      <DndContext sensors={sensors}>
        <MobileFormBuilder />
      </DndContext>
    );
  }

  return (
    <div className="w-full">
      <DndContext sensors={sensors}>
        <BuilderDragOverlay />

        <SidebarProvider
          open={isSidebarOpen}
          onOpenChange={setIsSidebarOpen}
          className="h-[calc(100vh-64px)] "
          style={
            {
              "--sidebar-width": "clamp(300px, 28vw, 440px)",
              "--sidbar-height": "40px",
            } as React.CSSProperties
          }
        >
          <Builder
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
          />
        </SidebarProvider>
      </DndContext>
    </div>
  );
}
