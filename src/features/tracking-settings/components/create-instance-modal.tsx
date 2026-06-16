"use client";

import React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Instance } from "./types";
import { useCreateIntegration } from "../hooks/use-integration";
import { useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { WhatsAppProvider } from "@/generated/prisma/enums";

interface CreateInstanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (instance: Instance) => void;
  trackingId: string;
}

export function CreateInstanceModal({
  open,
  onOpenChange,
  onCreated,
  trackingId,
}: CreateInstanceModalProps) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<WhatsAppProvider>(
    WhatsAppProvider.UAZAPI,
  );

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const createInstanceMutation = useCreateIntegration({ trackingId });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName("");
      setProvider(WhatsAppProvider.UAZAPI);
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  const params = useParams<{ trackingId: string }>();

  const resetForm = () => {
    setName("");
    setProvider(WhatsAppProvider.UAZAPI);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    createInstanceMutation.mutate(
      {
        name,
        provider,
        trackingId: params.trackingId,
      },
      {
        onSuccess: (data) => {
          onCreated({
            id: data.instance.id,
            instanceName: data.instance.instanceName,
            baseUrl: data.instance.baseUrl ?? "",
            apiKey: data.instance.apiKey ?? "",
            status: data.instance.status,
            instanceId: data.instance.instanceId ?? "",
            provider: data.instance.provider,
          });
          resetForm();
        },
        onError: (error) => {
          setError(error.message);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl">Criar Instância</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center py-8 space-y-4">
            <CheckCircle2Icon className="h-16 w-16 text-emerald-500" />
            <p className="text-center text-foreground">{success}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircleIcon className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Provedor</Label>
              <RadioGroup
                value={provider}
                onValueChange={(value) =>
                  setProvider(value as WhatsAppProvider)
                }
                className="grid gap-3"
              >
                <ProviderOption
                  id="create-provider-uazapi"
                  value={WhatsAppProvider.UAZAPI}
                  title="Uazapi (não-oficial)"
                  description="Conexão via QR Code com número pessoal/business. Sem template HSM, com risco de ban da Meta."
                  selected={provider === WhatsAppProvider.UAZAPI}
                />
                <ProviderOption
                  id="create-provider-meta"
                  value={WhatsAppProvider.META_CLOUD}
                  title="API Oficial (Meta Cloud)"
                  description="API oficial do WhatsApp Business. Após criar, conecte via Meta (OAuth) ou credenciais manuais no card do provedor."
                  selected={provider === WhatsAppProvider.META_CLOUD}
                />
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Nome da Instância
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome único da instância"
                required
                disabled={createInstanceMutation.isPending}
                className="h-11 bg-input/50"
                autoComplete="off"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createInstanceMutation.isPending || !name}
            >
              {createInstanceMutation.isPending && <Spinner />}
              Criar
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProviderOption({
  id,
  value,
  title,
  description,
  selected,
}: {
  id: string;
  value: WhatsAppProvider;
  title: string;
  description: string;
  selected: boolean;
}) {
  return (
    <Label
      htmlFor={id}
      className={
        "flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors " +
        (selected
          ? "border-primary bg-primary/5"
          : "border-border/50 hover:bg-muted/30")
      }
    >
      <RadioGroupItem id={id} value={value} className="mt-1" />
      <div className="space-y-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </Label>
  );
}
