"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
import { DraggableAttributes } from "@dnd-kit/core";
import { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Circle, Grip, MoreHorizontalIcon, Pencil } from "lucide-react";
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

// Função para calcular se a cor é clara ou escura
const getContrastColor = (hexColor: string): string => {
  // Remove o # se existir
  const hex = hexColor.replace("#", "");

  // Converte para RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calcula a luminância relativa (fórmula WCAG)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Retorna branco para cores escuras e preto para cores claras
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
};

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
              backgroundColor: data.color ?? "#1447e6",
              color: getContrastColor(data.color ?? "#1447e6"),
            }}
            className="rounded-sm px-2 "
          >
            {data.name}
          </span>
        </div>
      )}
      <ListOption currentColor={colorSelect} setCurrentColor={setColorSelect} />
    </div>
  );
};

interface ListOptionProps {
  currentColor: string;
  setCurrentColor: (color: string) => void;
}

const ListOption = ({ currentColor, setCurrentColor }: ListOptionProps) => {
  const { isMobile } = useSidebar();

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
                  <div className="dark:text-background bg-amber-50 w-40">
                    <SketchPicker
                      width="89%"
                      color={currentColor}
                      onChange={(e) => setCurrentColor(e.hex)}
                      disableAlpha
                      presetColors={[
                        "#D0021B",
                        "#F5A623",
                        "#F8E71C",
                        "#8B572A",
                        "#7ED321",
                        "#417505",
                      ]}
                    />
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
