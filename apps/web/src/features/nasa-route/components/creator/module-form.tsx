"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ModuleData {
  id?: string;
  title: string;
  summary?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
  initial?: ModuleData;
}

export function ModuleForm({ open, onClose, courseId, initial }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!initial?.id;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");

  const upsert = useMutation({
    ...orpc.nasaRoute.creatorUpsertModule.mutationOptions(),
    onSuccess: () => {
      toast.success(isEdit ? "Módulo atualizado!" : "Módulo criado!");
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({ input: { courseId } }),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.getCourseAsStudent.queryKey({ input: { courseId } }),
      });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Não foi possível salvar.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Título é obrigatório.");
      return;
    }
    upsert.mutate({
      id: initial?.id,
      courseId,
      title: title.trim(),
      summary: summary.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar módulo" : "Novo módulo"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="module-title">Título *</Label>
            <Input
              id="module-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="module-summary">Resumo</Label>
            <Textarea
              id="module-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={upsert.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={upsert.isPending} className="gap-1.5">
              {upsert.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
