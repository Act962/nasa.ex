"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { Save } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
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
import {
  BOTTOM_SHEET_ACTION_CLASS,
  BOTTOM_SHEET_BODY_CLASS,
  BOTTOM_SHEET_DIALOG_CLASS,
  BOTTOM_SHEET_FOOTER_CLASS,
  BOTTOM_SHEET_HANDLE_CLASS,
  BOTTOM_SHEET_HEADER_CLASS,
} from "../../lib/bottom-sheet-dialog";

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
      <DialogContent className={cn(BOTTOM_SHEET_DIALOG_CLASS, "sm:max-w-md")}>
        <div aria-hidden className={BOTTOM_SHEET_HANDLE_CLASS} />
        <DialogHeader className={BOTTOM_SHEET_HEADER_CLASS}>
          <DialogTitle>{isEdit ? "Editar módulo" : "Novo módulo"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className={BOTTOM_SHEET_BODY_CLASS}>
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
          </div>

          <DialogFooter className={BOTTOM_SHEET_FOOTER_CLASS}>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={upsert.isPending}
              className="max-sm:hidden"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={upsert.isPending} className={cn(BOTTOM_SHEET_ACTION_CLASS, "gap-1.5")}>
              {upsert.isPending ? (
                <OrbitaSpinner className="size-4 " />
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
