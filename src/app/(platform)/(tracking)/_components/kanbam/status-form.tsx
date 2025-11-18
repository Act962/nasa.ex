"use client";

import { Plus, X } from "lucide-react";
import { StatusWrapper } from "./status-wrapper";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const createStatusSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
});

type CreateStatusSchema = z.infer<typeof createStatusSchema>;

export const StatusForm = () => {
  const params = useParams<{ trackingId: string }>();
  const queryClient = useQueryClient();
  const form = useForm<CreateStatusSchema>({
    resolver: zodResolver(createStatusSchema),
  });

  const [isEditing, setIsEditing] = useState(false);

  const toggleEditing = () => {
    setIsEditing((prev) => !prev);
  };

  const createStatusColumn = useMutation(
    orpc.status.create.mutationOptions({
      onSuccess: () => {
        toast.success("Status criado com sucesso!");

        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: {
              trackingId: params.trackingId,
            },
          }),
        });

        setIsEditing(false);
        form.reset();
      },
      onError: () => {
        toast.error("Erro ao criar status, tente novamente");
      },
    })
  );

  const onSubmit = (data: CreateStatusSchema) => {
    createStatusColumn.mutate({
      name: data.name,
      trackingId: params.trackingId,
      color: "#1341D0",
    });
  };

  const isLoading = createStatusColumn.isPending;

  if (isEditing) {
    return (
      <StatusWrapper>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full p-3 rounded-md bg-muted/80 space-y-4 shadow-md"
        >
          <div>
            <Input
              autoFocus
              {...form.register("name")}
              id="title"
              placeholder="Digite um nome..."
              className="text-sm px-2 py-1 h-7 font-medium"
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center gap-x-1">
            <Button size="sm" type="submit" disabled={isLoading}>
              Adicionar
            </Button>
            <Button
              onClick={() => setIsEditing(false)}
              type="button"
              variant="ghost"
              size="icon-sm"
            >
              <X />
            </Button>
          </div>
        </form>
      </StatusWrapper>
    );
  }

  return (
    <StatusWrapper>
      <button
        onClick={toggleEditing}
        className="w-full rounded-md bg-muted/80 hover:bg-muted/90 transition p-3 flex items-center font-medium text-sm gap-2"
      >
        <Plus className="size-4" />
        Adicionar um status
      </button>
    </StatusWrapper>
  );
};
