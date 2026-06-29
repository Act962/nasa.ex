"use client";

import { useLostOrWin } from "@/hooks/use-lost-or-win";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from "../ui/select-studio";
import { Label } from "../ui/label";
import { InputGroup, InputGroupTextarea } from "../ui/input-group";
import { Button } from "../ui/button";
import z from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldError } from "../ui/field";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useReasons } from "@/features/reasons/hooks/use-reasons";
import { Skeleton } from "../ui/skeleton";
import { SelectItem } from "../ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";

const schemaLostOrWinner = z.object({
  observation: z.string().optional(),
  reasons: z.string().min(1, "Campo obrigatório"),
});

type FromLostOrWinner = z.infer<typeof schemaLostOrWinner>;

export function LostOrWinModal() {
  const { id: leadId, isOpen, onClose, type } = useLostOrWin();
  const params = useParams<{ trackingId: string }>();
  const queryClient = useQueryClient();
  const { reasons, isLoading } = useReasons(params.trackingId, type);

  const form = useForm({
    resolver: zodResolver(schemaLostOrWinner),
    defaultValues: {
      observation: "",
      reasons: "",
    },
  });

  const isLost = type === "LOSS";

  const mutation = useMutation(
    orpc.leads.updateAction.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: [
            "leads.listLeadsByStatus",
            data.lead.statusId,
            data.lead.trackingId,
          ],
        });
        queryClient.invalidateQueries({
          queryKey: orpc.status.getMany.queryKey({
            input: {
              trackingId: params.trackingId,
            },
          }),
        });

        toast.success("Lead atualizado com sucesso");
        form.reset();
        onClose();
      },
      onError: () => {
        toast.error("Erro ao atualizar lead");
      },
    }),
  );

  const onSubmit = (data: FromLostOrWinner) => {
    if (!leadId) return;

    mutation.mutate({
      leadId,
      action: isLost ? "LOSS" : "WIN",
      reasonId: data.reasons,
      observation: data.observation,
    });
  };

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isLost ? "Lead Perdido" : "Lead Ganho"}</DialogTitle>
          <DialogDescription>
            <span className="text-sm">
              {isLost ? "Não foi dessa vez" : "Parabéns você conseguiu"}
            </span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="popoverLost">
              Motivo de {isLost ? "Perda" : "Ganho"}
            </Label>
            <Controller
              name="reasons"
              control={form.control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="w-full " id="popoverLost">
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {isLoading &&
                        Array.from({ length: 5 }).map((_, index) => (
                          <Skeleton key={index} className="h-10" />
                        ))}
                      {!isLoading && reasons?.length === 0 && (
                        <span className="text-sm text-muted-foreground">
                          Nenhum motivo encontrado
                        </span>
                      )}
                      {!isLoading &&
                        reasons?.length > 0 &&
                        reasons.map((reason) => (
                          <SelectItem key={reason.id} value={reason.id}>
                            {reason.name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.reasons && (
              <FieldError>{form.formState.errors.reasons.message}</FieldError>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="textAreaPopover">Observações</Label>
            <InputGroup>
              <InputGroupTextarea
                className="resize-none break-all max-h-24"
                id="textAreaPopover"
                placeholder={`Descreva o motivo ${isLost ? "da perda" : "do ganho"}`}
                {...form.register("observation")}
              />
            </InputGroup>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Confirmar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
