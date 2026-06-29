"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function General() {
  const params = useParams<{ trackingId: string }>();
  const { data, isPending } = useSuspenseQuery(
    orpc.tracking.get.queryOptions({
      input: {
        trackingId: params.trackingId,
      },
    })
  );
  const queryClient = useQueryClient();
  const [name, setName] = useState(data.tracking.name);
  const [description, setDescription] = useState(data.tracking.description);

  const updateTracking = useMutation(
    orpc.tracking.update.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.get.queryKey({
            input: {
              trackingId: params.trackingId,
            },
          }),
        });

        toast.success(`${data.trackingName} atualizado com sucesso`);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const onSave = () => {
    updateTracking.mutate({
      trackingId: params.trackingId,
      name,
      description: description || "",
    });
  };

  const isUpdateTracking = updateTracking.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Geral</h2>
        <p className="text-muted-foreground text-sm">Configurações gerais</p>
      </div>

      <div>
        <div className="flex items-center justify-between py-6">
          <div>
            <h2 className="font-medium">Nome</h2>
            <span className="text-xs text-muted-foreground">
              Altere o nome do seu tracking
            </span>
          </div>

          {isPending && <Skeleton className="h-8 w-64 rounded-lg" />}

          {!isPending && (
            <Input
              placeholder="Digite seu nome"
              className="w-64"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isUpdateTracking}
            />
          )}
        </div>

        <Separator />

        <div className="flex items-center justify-between py-6">
          <div>
            <h2 className="font-medium">Descrição</h2>
            <span className="text-xs text-muted-foreground">
              Altere a descrição do seu tracking
            </span>
          </div>

          {isPending && <Skeleton className="h-8 w-64 rounded-lg" />}

          {!isPending && (
            <Textarea
              placeholder="Digite sua descrição"
              className="w-64 resize-none"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUpdateTracking}
            />
          )}
        </div>

        <Separator />

        <div className="flex items-center justify-end py-6">
          <Button type="button" onClick={onSave} disabled={isUpdateTracking}>
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
