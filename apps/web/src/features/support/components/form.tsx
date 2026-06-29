"use client";

import { S3 } from "@/lib/s3-client";
import { v4 as uuidv4 } from "uuid";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import {
  Loader2,
  Send,
  Image as ImageIcon,
  CheckCircle2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { APPS } from "@/features/apps/components/apps-data";
import { useCreateSupportTicket } from "../hooks/use-support";
import { Uploader } from "@/components/file-uploader/uploader";

const supportSchema = z.object({
  appId: z.string().min(1, "Selecione o aplicativo"),
  improvement: z
    .string()
    .min(10, "Descreva a melhoria com pelo menos 10 caracteres"),
  imageUrl: z.string().optional(),
});

type SupportValues = z.infer<typeof supportSchema>;

export function SupportForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const createTicket = useCreateSupportTicket();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupportValues>({
    resolver: zodResolver(supportSchema),
    defaultValues: {
      appId: "",
      improvement: "",
    },
  });

  const onSubmit = async (data: SupportValues) => {
    setIsSubmitting(true);

    try {
      await createTicket.mutateAsync(
        {
          appId: data.appId,
          improvement: data.improvement,
          imageUrl: data.imageUrl,
        },
        {
          onSuccess: () => {
            setIsSuccess(true);
          },
        }
      );
    } catch (e) {
      console.error("Erro no envio:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="mx-auto max-w-2xl border-primary/20 bg-primary/10 backdrop-blur-sm animate-in fade-in zoom-in duration-500">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 rounded-full bg-primary/15 p-3">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="mb-2 text-2xl">Sugestão Enviada!</CardTitle>
          <CardDescription className="text-lg">
            Obrigado por ajudar a NASA a evoluir. Nossa equipe analisará sua
            sugestão em breve.
          </CardDescription>
          <Button
            variant="outline"
            className="mt-8"
            onClick={() => {
              setIsSuccess(false);
              reset();
            }}
          >
            Enviar outra sugestão
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl shadow-2xl backdrop-blur-md">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary/20 p-2 rounded-lg">
            <Send className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Portal de Melhorias
          </CardTitle>
        </div>
        <CardDescription className="text-muted-foreground/80">
          Tem uma ideia para tornar nossos apps ainda melhores? Compartilhe com
          a equipe NASA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* App Selection */}
          <Field>
            <FieldLabel htmlFor="appId">Aplicativo</FieldLabel>
            <Controller
              name="appId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger
                    id="appId"
                    className="w-full bg-muted/30 border-border focus:border-primary/50 transition-colors h-11"
                  >
                    <SelectValue placeholder="Selecione o app que deseja melhorar" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {APPS.map((app) => (
                      <SelectItem
                        key={app.id}
                        value={app.id}
                        className="focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 py-1">
                          <div className="h-6 w-6 overflow-hidden rounded-md flex items-center justify-center bg-muted border border-border">
                            <app.icon />
                          </div>
                          <span className="font-medium">{app.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.appId && <FieldError>{errors.appId.message}</FieldError>}
          </Field>

          {/* Improvement Description */}
          <Field>
            <FieldLabel htmlFor="improvement">Sua Sugestão</FieldLabel>
            <Controller
              name="improvement"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  id="improvement"
                  placeholder="Descreva detalhadamente a melhoria ou funcionalidade que você gostaria de ver..."
                  className="min-h-35 bg-muted/30 border-border focus:border-primary/50 resize-none transition-all focus:min-h-50"
                />
              )}
            />
            <FieldDescription>
              Seja específico sobre o problema que essa melhoria resolve.
            </FieldDescription>
            {errors.improvement && (
              <FieldError>{errors.improvement.message}</FieldError>
            )}
          </Field>

          {/* Screenshot Upload */}
          <Field>
            <FieldLabel>Print da Tela (Opcional)</FieldLabel>
            <Controller
              name="imageUrl"
              control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-4">
                  <Uploader
                    value={field.value}
                    onConfirm={field.onChange}
                    fileTypeAccepted="image"
                  />
                </div>
              )}
            />
          </Field>

          <Button
            type="submit"
            className="w-full py-7 text-sm sm:text-lg font-bold"
            disabled={isSubmitting || createTicket.isPending}
          >
            {isSubmitting || createTicket.isPending ? (
              <>
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                Enviando Sugestão...
              </>
            ) : (
              <>
                <Send className="mr-3 h-5 w-5" />
                Enviar para Equipe NASA
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
