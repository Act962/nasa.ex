"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { LinnkerSheetDialog } from "./linnker-sheet-dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function toSlug(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function CreateLinnkerPageDialog({ open, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      client.linnker.createPage({ title, slug: slug.toLowerCase(), bio }),
    onSuccess: (response) => {
      toast.success("Página criada com sucesso!");
      setTitle("");
      setSlug("");
      setBio("");
      onSuccess();
      emitTourResult({ kind: GUIDE_RESULT_KINDS.linnkerPageCreated, href: `/linnker/${response.page.id}` });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Erro ao criar página");
    },
  });

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slug || slug === title.toLowerCase().replace(/\s+/g, "-")) {
      setSlug(toSlug(value));
    }
  };

  const isSubmitDisabled = isPending || !title || !slug;

  return (
    <LinnkerSheetDialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title="Nova página"
      icon={<Link2 className="size-4 text-info" />}
      description="Dê um nome e escolha o endereço. Links e aparência você ajusta depois."
      footer={
        <>
          <Button variant="outline" className="rounded-full max-sm:hidden" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="h-12 w-full rounded-full sm:h-9 sm:w-auto"
            onClick={() => mutate()}
            disabled={isSubmitDisabled}
            data-guide={GUIDE_ANCHORS.linnkerCreateSubmit.id}
          >
            {isPending ? "Criando..." : "Criar página"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Nome da página</Label>
          <Input
            placeholder="Ex: Meus links"
            value={title}
            className="h-11 sm:h-9"
            data-guide={GUIDE_ANCHORS.linnkerCreateTitle.id}
            onChange={(event) => handleTitleChange(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Endereço da página</Label>
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-sm text-muted-foreground">/l/</span>
            <Input
              placeholder="meus-links"
              value={slug}
              className="h-11 min-w-0 sm:h-9"
              onChange={(event) => setSlug(toSlug(event.target.value))}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">Só letras minúsculas, números e hífen.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Descrição (opcional)</Label>
          <Textarea
            placeholder="Uma breve descrição..."
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={3}
          />
        </div>
      </div>
    </LinnkerSheetDialog>
  );
}
