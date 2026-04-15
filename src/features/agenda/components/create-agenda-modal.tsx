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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateAgenda } from "../hooks/use-agenda";
import { useQueryTracking } from "@/features/tracking-settings/hooks/use-tracking";
import { useSpacePointCtx } from "@/features/space-point";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const url = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const createAgendaSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  link: z.string().min(1, "Link é obrigatório"),
  description: z.string().optional(),
  duration: z.number().min(1, "Duração é obrigatória"),
  trackingId: z.string().min(1, "Tracking é obrigatório"),
});

type CreateAgendaSchema = z.infer<typeof createAgendaSchema>;

export function CreateAgendaModal({ open, onOpenChange }: Props) {
  const { trackings, isLoadingTrackings } = useQueryTracking();
  const createAgenda = useCreateAgenda();
  const { earn } = useSpacePointCtx();

  const form = useForm<CreateAgendaSchema>({
    resolver: zodResolver(createAgendaSchema),
    defaultValues: {
      title: "",
      link: "",
      description: "",
      duration: 15,
    },
  });

  const [isLinkManuallyEdited, setIsLinkManuallyEdited] = useState(false);
  const title = form.watch("title");

  const onSubmit = async (data: CreateAgendaSchema) => {
    createAgenda.mutate(
      {
        name: data.title,
        description: data.description,
        duration: data.duration,
        slug: data.link,
        trackingId: data.trackingId,
      },
      {
        onSuccess: () => {
          earn("create_event", "Agenda criada 📅");
          onOpenChange(false);
        },
      },
    );
  };

  useEffect(() => {
    if (!isLinkManuallyEdited) {
      form.setValue("link", slugify(title));
    }
  }, [title, isLinkManuallyEdited, form]);

  useEffect(() => {
    if (open) {
      form.reset();
      setIsLinkManuallyEdited(false);
    }
  }, [open, form]);

  const isSubmitting = createAgenda.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar uma nova agenda</DialogTitle>
          <DialogDescription>Crie uma nova agenda</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel>Título</FieldLabel>
              <Input
                placeholder="Título da agenda"
                {...form.register("title")}
                disabled={isSubmitting}
              />
            </Field>

            <Field>
              <FieldLabel>Link</FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <InputGroupText>{url}/agenda/.../</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  {...form.register("link", {
                    onChange: (e) => {
                      setIsLinkManuallyEdited(true);
                      form.setValue("link", slugify(e.target.value));
                    },
                  })}
                  disabled={isSubmitting}
                  className="pl-0!"
                />
              </InputGroup>
            </Field>

            <Field>
              <FieldLabel>Descrição</FieldLabel>
              <Textarea
                placeholder="Descrição da agenda"
                {...form.register("description")}
                disabled={isSubmitting}
              />
            </Field>

            <Controller
              control={form.control}
              name="trackingId"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Tracking</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um tracking" />
                    </SelectTrigger>
                    <SelectContent>
                      {!isLoadingTrackings &&
                        trackings.length > 0 &&
                        trackings.map((tracking) => (
                          <SelectItem key={tracking.id} value={tracking.id}>
                            {tracking.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Field>
              <FieldLabel>Duração</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  placeholder="30"
                  type="number"
                  {...form.register("duration", {
                    valueAsNumber: true,
                  })}
                  disabled={isSubmitting}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>minutos</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-8">
            <DialogClose asChild>
              <Button variant="ghost" disabled={isSubmitting}>
                Fechar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              Continuar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
