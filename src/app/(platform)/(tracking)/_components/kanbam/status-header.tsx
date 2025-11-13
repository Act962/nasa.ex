"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
      statusId: data.id,
    });
  };

  return (
    <div className="pt-2 px-2 text-sm font-medium flex justify-between items-start gap-x-2">
      {isEditing ? (
        <>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 px-0.5"
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
          {data.name}
        </div>
      )}
      <ListOption />
    </div>
  );
};

const ListOption = () => {
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
            <DropdownMenuItem>
              <Pencil className="rounded-2xl bg-foreground size-3" />
              Editar título
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Circle className="rounded-2xl bg-foreground size-3" /> Editar cor
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
