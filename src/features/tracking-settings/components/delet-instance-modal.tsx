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
import { useDeleteIntegration } from "../hooks/use-integration";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

interface dataInstance {
  instanceId: string;
  instanceName: string;
  trackingId: string;
  apiKey: string;
  baseUrl: string;
}

interface DeleteInstanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: dataInstance;
}

export function DeleteInstanceModal({
  open,
  onOpenChange,
  data,
}: DeleteInstanceModalProps) {
  const [confirm, setConfirm] = useState("");
  const deleteInstanceMutation = useDeleteIntegration({
    trackingId: data.trackingId,
  });

  useEffect(() => {
    if (open) {
      setConfirm("");
    }
  }, [open]);

  const resetForm = () => {
    setConfirm("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    deleteInstanceMutation.mutate(
      {
        id: data.instanceId,
        apiKey: data.apiKey,
        baseUrl: data.baseUrl,
      },
      {
        onSuccess: (data) => {
          resetForm();
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl">Deletar Instancia</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="confirm">
              Digite o nome da instancia "{data.instanceName}" para confirmar a
              exclusão
            </Label>
            <Input
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Nome da instancia"
              required
              disabled={deleteInstanceMutation.isPending}
              className="h-11 bg-input/50"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={
              deleteInstanceMutation.isPending || confirm !== data.instanceName
            }
          >
            {deleteInstanceMutation.isPending && <Spinner />}
            Deletar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
