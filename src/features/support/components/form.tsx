"use client";

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

const supportSchema = z.object({
  appId: z.string().min(1, "Selecione o aplicativo"),
  improvement: z
    .string()
    .min(10, "Descreva a melhoria com pelo menos 10 caracteres"),
  image: z.any().optional(),
});

type SupportValues = z.infer<typeof supportSchema>;

export function SupportForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

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
    // Simulating API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("Support request sent:", data);
    setIsSubmitting(false);
    setIsSuccess(true);

    // Reset after some time or on manual click
  };

  const handleImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    onChange: (val: any) => void,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      onChange(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (onChange: (val: any) => void) => {
    setPreview(null);
    onChange(undefined);
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
              setPreview(null);
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
              name="image"
              control={control}
              render={({ field: { onChange } }) => (
                <div className="flex flex-col gap-4">
                  <div
                    className={cn(
                      "group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 transition-all hover:border-primary/50 hover:bg-primary/5",
                      preview && "border-primary/40 bg-muted/50 p-4",
                    )}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 cursor-pointer opacity-0 z-10"
                      onChange={(e) => handleImageChange(e, onChange)}
                    />

                    {preview ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border shadow-lg">
                        <img
                          src={preview}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center bg-linear-to-t from-background/90 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100 z-20">
                          <p className="text-sm font-medium text-foreground">
                            Clique ou arraste para trocar
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeImage(onChange);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="rounded-full bg-muted p-4 text-foreground group-hover:scale-110 transition-transform">
                          <ImageIcon className="text-foreground h-8 w-8" />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-foreground/90">
                            Anexar Screenshot
                          </p>
                          <p className="text-sm text-muted-foreground mt-1 text-balance">
                            Arraste uma imagem ou clique para selecionar
                            <br />
                            <span className="text-xs opacity-50">
                              PNG, JPG ou WEBP (Max. 5MB)
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            />
          </Field>

          <Button
            type="submit"
            className="w-full py-7 text-sm sm:text-lg font-bold"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
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
