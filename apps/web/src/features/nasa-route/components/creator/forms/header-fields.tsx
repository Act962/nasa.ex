"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Uploader } from "@/components/file-uploader/uploader";

export interface HeaderFieldsValue {
  coverUrl: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
}

interface Props {
  value: HeaderFieldsValue;
  onChange: (next: HeaderFieldsValue) => void;
  /** Chamado no `onBlur` do título — preenche slug se estiver vazio. */
  onAutoSlug?: () => void;
}

/**
 * Campos comuns a TODOS os formatos de produto: capa, título, slug,
 * subtítulo e descrição. Extraído de `course-form.tsx` pra manter o
 * arquivo principal abaixo de 400 linhas (regra do projeto).
 */
export function HeaderFields({ value, onChange, onAutoSlug }: Props) {
  const update = <K extends keyof HeaderFieldsValue>(
    k: K,
    v: HeaderFieldsValue[K],
  ) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Capa do produto</Label>
        <p className="text-xs text-muted-foreground">
          Recomendado: 1280×720 (16:9). PNG/JPG até 5MB.
        </p>
        <Uploader
          value={value.coverUrl}
          onUpload={(url) => update("coverUrl", url)}
          fileTypeAccepted="image"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            value={value.title}
            onChange={(e) => update("title", e.target.value)}
            onBlur={onAutoSlug}
            placeholder="Ex.: Vendas com STARs"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (URL) *</Label>
          <Input
            id="slug"
            value={value.slug}
            onChange={(e) => update("slug", e.target.value)}
            placeholder="vendas-com-stars"
            required
          />
          <p className="text-xs text-muted-foreground">
            Apenas letras minúsculas, números e hífens.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subtitle">Subtítulo</Label>
        <Input
          id="subtitle"
          value={value.subtitle}
          onChange={(e) => update("subtitle", e.target.value)}
          placeholder="Uma frase curta que descreve o produto"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição completa</Label>
        <Textarea
          id="description"
          value={value.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Descreva o que o aluno vai receber, para quem é o produto, pré-requisitos…"
          rows={6}
        />
      </div>
    </div>
  );
}
