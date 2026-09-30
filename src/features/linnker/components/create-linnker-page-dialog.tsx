"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/orpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateLinnkerPageDialog({ open, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      client.linnker.createPage({ title, slug: slug.toLowerCase(), bio }),
    onSuccess: (data) => {
      toast.success("Página criada com sucesso!");
      setTitle(""); setSlug(""); setBio("");
      onSuccess();
      emitTourResult({ kind: GUIDE_RESULT_KINDS.linnkerPageCreated, href: `/linnker/${data.page.id}` });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro ao criar página");
    },
  });

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slug || slug === title.toLowerCase().replace(/\s+/g, "-")) {
      setSlug(value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova página Linnker</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Título da página</Label>
            <Input
              placeholder="Ex: Meus links"
              value={title}
              data-guide={GUIDE_ANCHORS.linnkerCreateTitle.id}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Slug (URL pública)</Label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-sm">/l/</span>
              <Input
                placeholder="meus-links"
                value={slug}
                onChange={(e) =>
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Bio (opcional)</Label>
            <Textarea
              placeholder="Uma breve descrição..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={() => mutate()}
              disabled={isPending || !title || !slug}
              data-guide={GUIDE_ANCHORS.linnkerCreateSubmit.id}
            >
              {isPending ? "Criando..." : "Criar página"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
