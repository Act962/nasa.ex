"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Spinner } from "@/components/spinner";
import { useTracking } from "@/hooks/use-tracking-modal";

const createTrackingSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  description: z.string().optional(),
});

type CreateTrackingForm = z.infer<typeof createTrackingSchema>;

export function ModalCreateTracking() {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<CreateTrackingForm>({
    resolver: zodResolver(createTrackingSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const { isOpen, onOpen, onClose } = useTracking();

  const createTrackingMutation = useMutation(
    orpc.tracking.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Tracking ${data.trackingName}`);

        queryClient.invalidateQueries({
          queryKey: orpc.tracking.list.queryKey(),
        });

        reset();
        onClose();
      },
      onError: (error) => {
        console.log(error);
        toast.error("Erro ao criar tracking, tente novamente");
      },
    })
  );

  const onSubmit = async (data: CreateTrackingForm) => {
    createTrackingMutation.mutate({
      name: data.name,
      description: data.description,
    });
  };

  const isLoading = createTrackingMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar novo tracking</DialogTitle>
          <DialogDescription>
            Gernecie seus leads e mutio mais
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldSet>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nome</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  {...register("name")}
                  placeholder="Ex.: Acompanhamento"
                  autoFocus
                  disabled={isLoading}
                />
                {errors.name && <FieldError>{errors.name.message}</FieldError>}
                <FieldDescription>Dê um nome para o tracking</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="description">Descrição</FieldLabel>
                <Textarea
                  {...register("description")}
                  className="resize-none"
                  disabled={isLoading}
                />
              </Field>
            </FieldGroup>
          </FieldSet>

          <DialogFooter className="mt-3">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button className="sumbmit" disabled={isLoading}>
              {isLoading && <Spinner />}
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
