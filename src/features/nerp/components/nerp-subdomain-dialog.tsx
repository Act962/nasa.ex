"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CheckCircle2,
  Edit2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useCheckNerpSubdomain,
  useNerpOrg,
  useUpdateNerpSubdomain,
} from "@/features/nerp/hooks/use-nerp-org";
import { nerpSubdomainSchema } from "@/http/nerp/org/schemas";

// Base do domínio do nerp em prod. Suporta override via env pra ambientes
// staging/local. Sem `NEXT_PUBLIC_NERP_DOMAIN`, default = nasaerp.com.
const NERP_DOMAIN_BASE =
  process.env.NEXT_PUBLIC_NERP_DOMAIN ?? "https://nasaerp.com";

const formSchema = z.object({ subdomain: nerpSubdomainSchema });
type FormValues = z.infer<typeof formSchema>;

function buildSubdomainUrl(subdomain: string): string {
  try {
    const url = new URL(NERP_DOMAIN_BASE);
    return `${url.protocol}//${subdomain}.${url.host}`;
  } catch {
    return `https://${subdomain}.nasaerp.com`;
  }
}

export function NerpSubdomainDialog() {
  const org = useNerpOrg();
  const checkMutation = useCheckNerpSubdomain();
  const updateMutation = useUpdateNerpSubdomain();

  const currentSubdomain = org.data?.org.subdomain ?? "";
  const [isOpen, setIsOpen] = useState(false);
  // Quando true, o botão de submit vira "Salvar" (em vez de "Verificar").
  // Reseta sempre que o usuário muda o campo — força nova verificação.
  const [isAvailable, setIsAvailable] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { subdomain: currentSubdomain },
  });

  // Sincroniza com o dado vindo do nerp quando carrega/atualiza.
  useEffect(() => {
    if (currentSubdomain) {
      form.reset({ subdomain: currentSubdomain });
    }
  }, [currentSubdomain, form]);

  const subdomainValue = form.watch("subdomain");
  const hasChanges = subdomainValue !== currentSubdomain;
  const previewUrl = buildSubdomainUrl(subdomainValue || "subdomain");
  const currentUrl = currentSubdomain ? buildSubdomainUrl(currentSubdomain) : null;

  const onSubmit = (values: FormValues) => {
    if (isAvailable) {
      updateMutation.mutate(values, {
        onSuccess: () => {
          toast.success("Subdomínio atualizado!");
          setIsOpen(false);
          setIsAvailable(false);
        },
        onError: (err: { message?: string }) =>
          toast.error(err?.message ?? "Falha ao atualizar subdomínio"),
      });
      return;
    }

    checkMutation.mutate(values, {
      onSuccess: (res) => {
        if (res.available) {
          setIsAvailable(true);
          toast.success("Subdomínio disponível! Clique em Salvar.");
        } else {
          setIsAvailable(false);
          form.setError("subdomain", {
            type: "manual",
            message: res.message ?? "Este subdomínio não está disponível",
          });
        }
      },
      onError: (err: { message?: string }) => {
        setIsAvailable(false);
        toast.error(err?.message ?? "Erro ao verificar subdomínio");
      },
    });
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      form.reset({ subdomain: currentSubdomain });
      form.clearErrors();
      setIsAvailable(false);
    }
  };

  const isChecking = checkMutation.isPending;
  const isSaving = updateMutation.isPending;
  const isLoading = isChecking || isSaving;
  const isFormValid = form.formState.isValid && subdomainValue.length >= 3;

  return (
    <div className="space-y-2">
      <Label>Subdomínio da loja</Label>
      <div className="flex items-center gap-2 flex-wrap">
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            {org.isLoading ? (
              <Skeleton className="h-9 w-72" />
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="font-mono text-xs gap-2 justify-between min-w-0 max-w-full"
              >
                <span className="truncate">
                  {currentUrl ?? "Configurar subdomínio"}
                </span>
                <Edit2 className="size-3.5 shrink-0" />
              </Button>
            )}
          </DialogTrigger>

          {currentUrl && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              asChild
              title="Abrir loja em nova aba"
            >
              <a href={currentUrl} target="_blank" rel="noopener noreferrer">
                <ArrowUpRight className="size-4" />
              </a>
            </Button>
          )}

          <DialogContent showCloseButton={false} className="sm:max-w-xl">
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>Alterar endereço da loja online</DialogTitle>
                <DialogDescription>
                  Esse é o link que seus clientes acessam.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div
                  className={cn(
                    "rounded-md border px-3 py-2 text-center font-mono text-sm bg-muted/40 break-all",
                  )}
                >
                  {previewUrl}
                </div>

                <Controller
                  control={form.control}
                  name="subdomain"
                  render={({ field, fieldState }) => (
                    <div className="space-y-2">
                      <Label htmlFor="subdomain">Novo subdomínio</Label>
                      <div className="relative">
                        <Input
                          {...field}
                          id="subdomain"
                          placeholder="minhaloja"
                          autoComplete="off"
                          aria-invalid={fieldState.invalid}
                          disabled={isLoading}
                          onChange={(e) => {
                            // Mesmo filtro do nerp: a-z, 0-9 e hífen.
                            const v = e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "");
                            field.onChange(v);
                            if (isAvailable) setIsAvailable(false);
                            if (fieldState.error)
                              form.clearErrors("subdomain");
                          }}
                          className={cn(
                            fieldState.error &&
                              "border-destructive focus-visible:ring-destructive",
                          )}
                        />
                        {isAvailable && hasChanges && (
                          <CheckCircle2 className="absolute right-3 top-2.5 size-4 text-emerald-600" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        3-63 caracteres. Apenas letras minúsculas, números e
                        hífens.
                      </p>
                      {fieldState.error && (
                        <p className="text-xs text-destructive">
                          {fieldState.error.message}
                        </p>
                      )}
                    </div>
                  )}
                />
              </div>

              <DialogFooter className="mt-6">
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isLoading}>
                    Cancelar
                  </Button>
                </DialogClose>
                {isAvailable ? (
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isSaving && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    Salvar
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={!isFormValid || !hasChanges || isLoading}
                  >
                    {isChecking && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    Verificar disponibilidade
                  </Button>
                )}
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {currentUrl && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <ExternalLink className="size-3" />
          URL pública atual do catálogo.
        </p>
      )}
    </div>
  );
}
