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
  DialogTrigger,
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
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import createTracking from "../actions";
import { toast } from "sonner";

const createTrackingSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  description: z.string().optional(),
});

type CreateTrackingForm = z.infer<typeof createTrackingSchema>;

export function ModalCreateTracking({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTrackingForm>({
    resolver: zodResolver(createTrackingSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const [isOpen, setIsOpen] = useState(false);

  const onSubmit = async (data: CreateTrackingForm) => {
    const result = await createTracking({
      ...data,
    });

    if (result?.error) {
      toast.error("Erro ao criar tracking");
    }

    toast.success("Tracking criado com sucesso");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
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
                />
                {errors.name && <FieldError>{errors.name.message}</FieldError>}
                <FieldDescription>Dê um nome para o tracking</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="description">Descrição</FieldLabel>
                <Textarea
                  {...register("description")}
                  className="resize-none"
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
            <Button className="sumbmit">Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
