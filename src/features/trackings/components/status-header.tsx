"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useKanbanStore } from "../lib/kanban-store";
import { useSidebar } from "@/components/ui/sidebar";
import { useUpdateStatusName } from "@/features/status/hooks/use-status";
import { cn } from "@/lib/utils";
import { getContrastColor } from "@/utils/get-contrast-color";
import { DraggableAttributes } from "@dnd-kit/core";
import { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { zodResolver } from "@hookform/resolvers/zod";
import { Grip, MoreHorizontalIcon, Plus, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { SketchPicker } from "react-color";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useDeleteStatus } from "../hooks/use-trackings";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import dayjs from "dayjs";
import { orpc } from "@/lib/orpc";

interface StatusHeaderProps {
  id: string;
  name: string;
  color: string | null;
  trackingId: string;
  leads: number;
}

export const updateSatusName = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
});

export const StatusHeader = ({
  data,
  attributes,
  listeners,
}: {
  data: StatusHeaderProps;
  attributes: DraggableAttributes;
  listeners?: SyntheticListenerMap;
}) => {
  const form = useForm({
    resolver: zodResolver(updateSatusName),
    defaultValues: {
      name: data.name,
    },
  });
  const [colorSelect, setColorSelect] = useState(data.color ?? "#1447e6");

  const updateStatusNameMutation = useUpdateStatusName();
  const deleteStatusMutation = useDeleteStatus();

  const [isEditing, setIsEditing] = useState(false);

  const toggleEditing = () => {
    setIsEditing((prev) => !prev);
  };

  const onSubmit = (formData: { name: string }) => {
    updateStatusNameMutation.mutate(
      {
        name: formData.name,
        statusId: data.id,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  };

  const onColorChange = (newColor: string) => {
    setColorSelect(newColor);
    updateStatusNameMutation.mutate({
      name: data.name,
      color: newColor,
      statusId: data.id,
    });
  };

  const handleDeleteStatus = () => {
    deleteStatusMutation.mutate({
      statusId: data.id,
    });
  };

  return (
    <div className="pt-2 px-2 text-sm font-medium flex justify-between items-start gap-x-2">
      {isEditing ? (
        <>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 px-0.5 "
          >
            <Input
              placeholder="Digite um nome..."
              {...form.register("name")}
              autoFocus
              className="h-7 text-sm py-1 px-1.5 font-medium truncate"
              onBlur={() => setIsEditing(false)}
            />
          </form>
        </>
      ) : (
        <div
          onClick={toggleEditing}
          className="w-full flex items-center justify-start text-sm py-1 h-7 font-medium border-transparent truncate"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="touch-none active:cursor-grabbing cursor-grab focus-visible:ring-0"
            {...listeners}
            {...attributes}
          >
            <Grip className="size-4" />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                style={{
                  backgroundColor: colorSelect,
                  color: getContrastColor(colorSelect),
                }}
                className="rounded-sm px-2 truncate"
              >
                {data.name}
              </span>
            </TooltipTrigger>
            <TooltipContent>{data.name}</TooltipContent>
          </Tooltip>
          <StatusLeadsCount
            columnId={data.id}
            trackingId={data.trackingId}
            fallback={data.leads}
          />
        </div>
      )}
      <ListOption
        currentColor={colorSelect}
        onColorChange={onColorChange}
        handleDeleteStatus={handleDeleteStatus}
      />
    </div>
  );
};

// Leaf component que subscreve sozinho ao count via TanStack Query.
// Quando o count muda (drag de lead, refetch), só ESTE componente
// re-renderiza — não cascateia pro StatusColumn (que está memoizado
// ignorando leads count) nem pro StatusHeader. Isso quebra o ciclo
// de ref churn que o memo do StatusColumn deixava passar quando o
// count mudava.
function StatusLeadsCount({
  columnId,
  trackingId,
  fallback,
}: {
  columnId: string;
  trackingId: string;
  fallback: number;
}) {
  const [dateInit] = useQueryState("date_init");
  const [dateEnd] = useQueryState("date_end");
  const [participantFilter] = useQueryState("participant");
  const [tagsFilter] = useQueryState("tags");
  const [temperatureFilter] = useQueryState("temperature");
  const [actionFilter] = useQueryState("filter");

  const baseOptions = orpc.status.getMany.queryOptions({
    input: {
      trackingId,
      dateInit: dateInit
        ? dayjs(dateInit).startOf("day").toDate().toISOString()
        : undefined,
      dateEnd: dateEnd
        ? dayjs(dateEnd).endOf("day").toDate().toISOString()
        : undefined,
      participantFilter: participantFilter || undefined,
      tagsFilter: tagsFilter ? tagsFilter.split(",") : undefined,
      temperatureFilter: temperatureFilter
        ? temperatureFilter.split(",")
        : undefined,
      actionFilter: (actionFilter || "ACTIVE") as any,
    },
  });

  const { data: count } = useQuery({
    ...baseOptions,
    select: (data: any) =>
      data?.find((s: any) => s.id === columnId)?._count?.leads ?? fallback,
  });

  return (
    <span className="text-xs text-muted-foreground ml-2">
      {count ?? fallback}
    </span>
  );
}

interface ListOptionProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  handleDeleteStatus: () => void;
}

const ListOption = ({
  currentColor,
  onColorChange,
  handleDeleteStatus,
}: ListOptionProps) => {
  const { isMobile } = useSidebar();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [tempColor, setTempColor] = useState(currentColor);
  const deleteStatusMutation = useDeleteStatus();
  const sortBy = useKanbanStore((s) => s.sortBy);
  const setSortBy = useKanbanStore((s) => s.setSortBy);

  const colors = [
    "#FFFFFF",
    "#595D66",
    "#f6fa14",
    "#1090E0",
    "#EE5E99",
    "#3DB88B",
    "#E16B16",
    "#B660E0",
    "#FE5050",
    "#FAB515",
    "#7A5FDF",
  ];

  const handlePresetColorClick = (color: string) => {
    onColorChange(color);
  };

  const handlePickerSave = () => {
    onColorChange(tempColor);
    setIsPickerOpen(false);
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-40"
          align={isMobile ? "end" : "start"}
        >
          <DropdownMenuLabel>Mais ações</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Editar cor</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <div className="w-40 pb-1 px-2">
                    <span className="text-sm font-medium">Cores</span>
                    <div className="grid grid-cols-6 gap-x-1.5 gap-y-2 mt-2">
                      {colors.map((color) => (
                        <div
                          role="button"
                          key={color}
                          className={cn(
                            "size-5 rounded-full transition-all border border-transparent flex items-center justify-center hover:border-border",
                            color === currentColor && "border-border",
                          )}
                        >
                          <div
                            className={`size-3.5 rounded-full transition-transform`}
                            style={{ backgroundColor: color }}
                            onClick={() => handlePresetColorClick(color)}
                          />
                        </div>
                      ))}
                      <DropdownMenu
                        dir="ltr"
                        open={isPickerOpen}
                        onOpenChange={setIsPickerOpen}
                      >
                        <DropdownMenuTrigger asChild>
                          <Plus className="size-4 hover:bg-accent-foreground/10 transition-colors cursor-pointer rounded-xl" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-54">
                          <div className="px-1 pb-2 space-y-2 items-center">
                            <SketchPicker
                              width=""
                              color={tempColor}
                              onChange={(e) => setTempColor(e.hex)}
                              disableAlpha
                              presetColors={[]}
                            />
                            <Button
                              onClick={handlePickerSave}
                              className="w-full"
                            >
                              Salvar
                            </Button>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer"
              onClick={handleDeleteStatus}
            >
              <Trash2Icon className="size-4" />
              Deletar
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
