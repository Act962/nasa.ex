"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppModule } from "@/features/insights/types";
import type { InsightBlock } from "@/lib/insights/app-metrics";
import { useOrgLayout } from "@/features/insights/context/org-layout-provider";

interface SortableDashboardSectionsProps {
  selectedModules: AppModule[];
  sections: Partial<Record<AppModule, ReactNode>>;
  renderTagTile?: (block: Extract<InsightBlock, { type: "tag-tile" }>) => ReactNode;
  renderAppMetric?: (
    block: Extract<InsightBlock, { type: "app-metric" }>,
  ) => ReactNode;
  renderCustomChart?: (
    block: Extract<InsightBlock, { type: "custom-chart" }>,
  ) => ReactNode;
  renderAddAnchor?: (
    block: Extract<InsightBlock, { type: "add-anchor" }>,
  ) => ReactNode;
}

export function SortableDashboardSections({
  selectedModules,
  sections,
  renderTagTile,
  renderAppMetric,
  renderCustomChart,
  renderAddAnchor,
}: SortableDashboardSectionsProps) {
  const { blocks, reorderBlocks, canEdit } = useOrgLayout();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visible = useMemo(() => {
    return blocks.filter((b) => {
      if (b.type === "section") {
        return (
          selectedModules.includes(b.appModule) && sections[b.appModule] != null
        );
      }
      return true;
    });
  }, [blocks, selectedModules, sections]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    reorderBlocks(arrayMove(blocks, oldIndex, newIndex));
  };

  if (visible.length === 0) return null;

  if (!mounted || !canEdit) {
    return (
      <div className="space-y-8">
        {visible.map((b) => (
          <BlockRenderer
            key={b.id}
            block={b}
            sections={sections}
            renderTagTile={renderTagTile}
            renderAppMetric={renderAppMetric}
            renderCustomChart={renderCustomChart}
            renderAddAnchor={renderAddAnchor}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={visible.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-8">
          {visible.map((b) => (
            <SortableBlock key={b.id} id={b.id}>
              <BlockRenderer
                block={b}
                sections={sections}
                renderTagTile={renderTagTile}
                renderAppMetric={renderAppMetric}
                renderCustomChart={renderCustomChart}
                renderAddAnchor={renderAddAnchor}
              />
            </SortableBlock>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function BlockRenderer({
  block,
  sections,
  renderTagTile,
  renderAppMetric,
  renderCustomChart,
  renderAddAnchor,
}: {
  block: InsightBlock;
  sections: Partial<Record<AppModule, ReactNode>>;
  renderTagTile?: SortableDashboardSectionsProps["renderTagTile"];
  renderAppMetric?: SortableDashboardSectionsProps["renderAppMetric"];
  renderCustomChart?: SortableDashboardSectionsProps["renderCustomChart"];
  renderAddAnchor?: SortableDashboardSectionsProps["renderAddAnchor"];
}) {
  if (block.type === "section") {
    return <>{sections[block.appModule] ?? null}</>;
  }
  if (block.type === "tag-tile") return <>{renderTagTile?.(block) ?? null}</>;
  if (block.type === "app-metric")
    return <>{renderAppMetric?.(block) ?? null}</>;
  if (block.type === "custom-chart")
    return <>{renderCustomChart?.(block) ?? null}</>;
  if (block.type === "add-anchor")
    return <>{renderAddAnchor?.(block) ?? null}</>;
  return null;
}

function SortableBlock({ id, children }: { id: string; children: ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group/section rounded-xl",
        isDragging && "opacity-40 z-10",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Arrastar bloco"
        title="Arrastar para reorganizar"
        className="absolute -left-2 md:-left-8 top-2 z-10 flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing shadow-sm"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      {children}
    </div>
  );
}
