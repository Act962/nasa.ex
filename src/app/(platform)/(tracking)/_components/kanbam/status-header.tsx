"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useSidebar } from "@/components/ui/sidebar";
import { orpc } from "@/lib/orpc";
import { getContrastColor } from "@/utils/get-contrast-color";
import { DraggableAttributes } from "@dnd-kit/core";
import { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Grip, MoreHorizontalIcon, Plus } from "lucide-react";
import { useState } from "react";
import { SketchPicker } from "react-color";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface StatusHeaderProps {
  id: string;
  name: string;
  color: string | null;
  order: number;
  trackingId: string;
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
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(updateSatusName),
    defaultValues: {
      name: data.name,
    },
  });
  const [colorSelect, setColorSelect] = useState(data.color ?? "#1447e6");

  const updateStatusNameMutation = useMutation(
    orpc.status.update.mutationOptions({
      onSuccess: () => {
        toast.success("Status atualizado com sucesso!");

        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: {
              trackingId: data.trackingId,
            },
          }),
        });

        setIsEditing(false);
      },
      onError: () => {
        toast.error("Erro ao atualizar status, tente novamente");
      },
    })
  );

  const [isEditing, setIsEditing] = useState(false);

  const toggleEditing = () => {
    setIsEditing((prev) => !prev);
  };

  const onSubmit = (formData: { name: string }) => {
    updateStatusNameMutation.mutate({
      name: formData.name,
      color: colorSelect,
      statusId: data.id,
    });
  };

  const onColorChange = (newColor: string) => {
    setColorSelect(newColor);
    updateStatusNameMutation.mutate({
      name: data.name,
      color: newColor,
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
            className="touch-none active:cursor-grabbing cursor-grab"
            {...listeners}
            {...attributes}
          >
            <Grip className="size-4" />
          </Button>
          <span
            style={{
              backgroundColor: colorSelect,
              color: getContrastColor(colorSelect),
            }}
            className="rounded-sm px-2 "
          >
            {data.name}
          </span>
        </div>
      )}
      <ListOption currentColor={colorSelect} onColorChange={onColorChange} />
    </div>
  );
};

interface ListOptionProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

const ListOption = ({ currentColor, onColorChange }: ListOptionProps) => {
  const { isMobile } = useSidebar();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [tempColor, setTempColor] = useState(currentColor);

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
                    <div className="grid grid-cols-6 gap-x-1.5 gap-y-2">
                      {colors.map((color) => (
                        <div key={color}>
                          <div
                            className="w-4 h-4 rounded-full cursor-pointer hover:scale-110 transition-transform"
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
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
