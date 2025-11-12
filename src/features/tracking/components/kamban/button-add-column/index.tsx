"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CirclePlus, Loader2 } from "lucide-react";
import { useState } from "react";
import { X } from "lucide-react";
import z from "zod";
import { schema } from "./schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldError } from "@/components/ui/field";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { useParams } from "next/navigation";

type CreateColumnForm = z.infer<typeof schema>;

export function ButtonAddColumn() {
  const params = useParams<{ trackingId: string }>();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateColumnForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
    },
  });

  const [isCreating, setIsCreating] = useState(false);

  function toggleCreating() {
    setIsCreating(!isCreating);
  }

  const createColumnMutation = useMutation(
    orpc.status.create.mutationOptions({
      onSuccess: (newColumn) => {
        toast.success(`Coluna ${newColumn.statusName} criada com sucesso!`);

        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: {
              trackingId: params.trackingId,
            },
          }),
        });

        reset();
        toggleCreating();
      },
      onError: () => {
        toast.error("Erro ao criar coluna, tente novamente");
      },
    })
  );

  function handleAddColumn(data: CreateColumnForm) {
    if (!params.trackingId) return;

    createColumnMutation.mutate({
      name: data.name,
      trackingId: params.trackingId,
      color: "#1447E6",
    });
  }

  const isLoading = createColumnMutation.isPending;

  return (
    <>
      {!isCreating ? (
        <div
          className="flex ml-2 rounded-2xl gap-2 justify-center items-center flex-row px-8 py-4 bg-foreground/5 hover:bg-foreground/10 hover:transition-colors w-[350px]"
          onClick={toggleCreating}
        >
          Adicionar
          <CirclePlus size={18} />
        </div>
      ) : (
        <form onSubmit={handleSubmit(handleAddColumn)}>
          <div className="flex flex-col gap-3 bg-foreground/5 rounded-2xl px-5 py-4 ml-2 w-[350px]">
            Nova coluna
            <Input
              {...register("name")}
              placeholder="Ex: Coluna de compras"
              autoFocus
              disabled={isLoading}
            />
            {errors.name && <FieldError>{errors.name.message}</FieldError>}
            <div className="flex flex-row  gap-2 items-center">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="size-4 animate-spin" />}
                Adicionar Lista
              </Button>
              <X
                className="cursor-pointer hover:bg-foreground/5 p-1 rounded transition-colors"
                onClick={toggleCreating}
                size={26}
              />
            </div>
          </div>
        </form>
      )}
    </>
  );
}
