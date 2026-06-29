"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { FormBlockInstance } from "@/features/form/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  jsonBlock?: string;
  createdAt: string;
}

function FormPatternCard({
  template,
  onPreview,
  onUse,
  duplicating,
}: {
  template: FormTemplate;
  onPreview: (t: FormTemplate) => void;
  onUse: (t: FormTemplate) => void;
  duplicating: string | null;
}) {
  return (
    <div className="w-full h-auto cursor-pointer rounded-xl border-2 border-violet-500/40 hover:border-violet-500/70 transition-colors overflow-hidden" onClick={() => onPreview(template)}>
      <div className="w-full relative flex items-center justify-center overflow-hidden h-[150px] bg-linear-to-b from-primary/10 to-primary/10">
        <button
          onClick={(e) => { e.stopPropagation(); onUse(template); }}
          disabled={duplicating === template.id}
          className="absolute top-2 right-2 z-10 flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-500 bg-background/90 rounded-md px-2 py-1 border border-violet-200 shadow-sm disabled:opacity-50"
        >
          {duplicating === template.id
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Copy className="w-3 h-3" />}
          Usar
        </button>
        <div className="w-36 absolute bottom-0 flex items-center flex-col px-4 pt-6 h-32 rounded-t-xl bg-white shadow-lg">
          <h5 className="text-sm font-medium mb-1 text-center text-gray-400 truncate block w-full px-2">
            {template.name}
          </h5>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1 mb-2 w-full">
              <Skeleton className="h-3 w-3 rounded-full shrink-0" />
              <Skeleton className="h-[11px] flex-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="w-full px-3 py-2 text-center">
        <p className="text-sm font-semibold truncate">{template.name}</p>
        {template.description && (
          <p className="text-xs text-muted-foreground truncate">{template.description}</p>
        )}
      </div>
    </div>
  );
}

function FormPreviewModal({
  template,
  onClose,
  onUse,
  duplicating,
}: {
  template: FormTemplate | null;
  onClose: () => void;
  onUse: (t: FormTemplate) => void;
  duplicating: string | null;
}) {
  if (!template) return null;

  let blocks: FormBlockInstance[] = [];
  try {
    blocks = JSON.parse(template.jsonBlock ?? "[]");
  } catch {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative w-full max-w-xl max-h-[85vh] flex flex-col bg-background rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-base">{template.name}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUse(template)}
              disabled={duplicating === template.id}
              className="flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-500 border border-violet-300 rounded-md px-3 py-1.5 disabled:opacity-50"
            >
              {duplicating === template.id
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Copy className="w-3.5 h-3.5" />}
              Usar
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form preview */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          {blocks.map((block) => {
            if (block.blockType === "RowLayout" && block.childblocks?.length) {
              return (
                <div key={block.id} className="flex flex-col gap-3">
                  {block.childblocks.map((child) => {
                    const Comp = FormBlocks[child.blockType]?.formComponent;
                    if (!Comp) return null;
                    return <Comp key={child.id} blockInstance={child} />;
                  })}
                </div>
              );
            }
            const Comp = FormBlocks[block.blockType]?.formComponent;
            if (!Comp) return null;
            return <Comp key={block.id} blockInstance={block} />;
          })}
        </div>
      </div>
    </div>
  );
}

export function FormPatternsSection() {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [preview, setPreview] = useState<FormTemplate | null>(null);
  const [confirm, setConfirm] = useState<FormTemplate | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/app-templates?appType=form")
      .then((r) => r.json())
      .then((data) => setTemplates(data.form ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleUse = (template: FormTemplate) => {
    setPreview(null);
    setConfirm(template);
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const tpl = confirm;
    setConfirm(null);
    setDuplicating(tpl.id);
    try {
      const res = await fetch(`/api/admin/app-template/form/${tpl.id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Erro");
      const created = await res.json();
      toast.success(`"${tpl.name}" adicionado com sucesso!`);
      router.push(`/form/builder/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao usar padrão");
    } finally {
      setDuplicating(null);
    }
  };

  if (isLoading || templates.length === 0) return null;

  return (
    <>
      <div className="mt-8 border-2 border-violet-500/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide">
            Padrões NASA disponíveis
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {templates.map((t) => (
            <FormPatternCard
              key={t.id}
              template={t}
              onPreview={setPreview}
              onUse={handleUse}
              duplicating={duplicating}
            />
          ))}
        </div>
      </div>

      <FormPreviewModal
        template={preview}
        onClose={() => setPreview(null)}
        onUse={handleUse}
        duplicating={duplicating}
      />

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usar padrão "{confirm?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso criará um novo formulário com todas as configurações deste padrão. Você poderá editar livremente após a criação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Criar a partir deste padrão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
