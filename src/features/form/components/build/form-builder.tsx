"use client";
import React, { useState } from "react";
import { DndContext, MouseSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useBuilderStore } from "../../context/builder-form-provider";
import { Builder } from "@/features/form/components/build/builder";
import { BuilderDragOverlay } from "@/features/form/components/common/utils/builder-drag-overlay";

import { useEffect } from "react";

export function FormBuilder({ formId }: { formId: string }) {
  const { formData, fetchFormById } = useBuilderStore();
  const isPublished = formData?.published;

  useEffect(() => {
    if (formId) {
      fetchFormById(formId);
    }
  }, [formId, fetchFormById]);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(
    isPublished ? false : true,
  );
  return (
    <div className="w-full">
      <DndContext sensors={useSensors(mouseSensor)}>
        <BuilderDragOverlay />

        <SidebarProvider
          open={isSidebarOpen}
          onOpenChange={setIsSidebarOpen}
          className="h-[calc(100vh-64px)] "
          style={
            {
              "--sidebar-width": "300px",
              "--sidbar-height": "40px",
            } as React.CSSProperties
          }
        >
          <Builder {...{ isSidebarOpen }} />
        </SidebarProvider>
      </DndContext>
    </div>
  );
}
