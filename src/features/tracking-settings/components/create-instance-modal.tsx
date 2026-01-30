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
import { Instance } from "./types";
import { useCreateIntegration } from "../hooks/use-integration";
import { useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";

interface CreateInstanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (instance: Instance) => void;
  trackingId: string;
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export function CreateInstanceModal({
  open,
  onOpenChange,
  onCreated,
  trackingId,
}: CreateInstanceModalProps) {
  const [name, setName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const createInstanceMutation = useCreateIntegration({ trackingId });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  const params = useParams<{ trackingId: string }>();

  const resetForm = () => {
    setName(generateId());
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    createInstanceMutation.mutate(
      {
        name,
        trackingId: params.trackingId,
      },
      {
        onSuccess: (data) => {
          onCreated({
            id: data.instance.id,
            instanceName: data.instance.instanceName,
            baseUrl: data.instance.baseUrl,
            apiKey: data.instance.apiKey,
            status: data.instance.status,
            instanceId: data.instance.instanceId,
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
          <DialogTitle className="text-xl">Criar Instancia</DialogTitle>
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
              <Label htmlFor="name" className="text-sm font-medium">
                Nome da Instancia
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome unico da instancia"
                required
                disabled={createInstanceMutation.isPending}
                className="h-11 bg-input/50"
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
