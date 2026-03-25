"use client";
import React, { useState } from "react";
import { Loader } from "lucide-react";
import { DndContext, MouseSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useBuilderStore } from "../context/builder-form-provider";
import Builder from "./builder";
import { BuilderDragOverlay } from "./builder-drag-overlay";

export function FormBuilder() {
  const { loading, formData } = useBuilderStore();
  const isPublished = formData?.published;

  if (loading) {
    return (
      <div
        className="w-full 
    flex h-56
     items-center
      justify-center"
      >
        <Loader size="3rem" className="animate-spin" />
      </div>
    );
  }

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(
    isPublished ? false : true,
  );
  return (
    <div>
      <DndContext sensors={useSensors(mouseSensor)}>
        <BuilderDragOverlay />

        <SidebarProvider
          open={isSidebarOpen}
          onOpenChange={setIsSidebarOpen}
          className="h-[calc(100vh-64px)]"
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
