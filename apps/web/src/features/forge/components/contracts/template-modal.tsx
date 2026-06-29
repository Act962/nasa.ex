"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateForgeTemplate, useUpdateForgeTemplate } from "../../hooks/use-forge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { AVAILABLE_VARIABLES } from "../../utils/render-template";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  content: z.string().min(1, "Texto do contrato obrigatório"),
  defaultStartDate: z.string().optional(),
  defaultEndDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Template {
  id: string;
  name: string;
  content: string;
  defaultStartDate: Date | null;
  defaultEndDate: Date | null;
}

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  template?: Template | null;
}

export function TemplateModal({ open, onClose, template }: TemplateModalProps) {
  const create = useCreateForgeTemplate();
  const update = useUpdateForgeTemplate();

  const form = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: "",
      content: "",
      defaultStartDate: "",
      defaultEndDate: "",
    },
  });

  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        content: template.content,
        defaultStartDate: template.defaultStartDate
          ? new Date(template.defaultStartDate).toISOString().split("T")[0]
          : "",
        defaultEndDate: template.defaultEndDate
          ? new Date(template.defaultEndDate).toISOString().split("T")[0]
          : "",
      });
    } else {
      form.reset({ name: "", content: "", defaultStartDate: "", defaultEndDate: "" });
    }
  }, [template, open]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        name: data.name,
        content: data.content,
        defaultStartDate: data.defaultStartDate || null,
        defaultEndDate: data.defaultEndDate || null,
      };
      if (template) {
        await update.mutateAsync({ id: template.id, ...payload });
        toast.success("Padrão atualizado");
      } else {
        await create.mutateAsync(payload);
        toast.success("Padrão criado");
      }
      onClose();
    } catch {
      toast.error("Erro ao salvar padrão");
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar Padrão de Contrato" : "Novo Padrão de Contrato"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Nome do padrão *</Label>
            <Input {...form.register("name")} placeholder="Ex: Contrato de Prestação de Serviços" />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Default dates */}
          <div className="space-y-2">
            <Label>Datas padrão <span className="text-[11px] text-muted-foreground font-normal">(opcional — preenchidas ao usar este modelo)</span></Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data de início</Label>
                <Input type="date" {...form.register("defaultStartDate")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data de término</Label>
                <Input type="date" {...form.register("defaultEndDate")} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Content */}
          <div className="space-y-2">
            <Label>Texto do contrato *</Label>
            <details className="group rounded-md border border-border/60 bg-muted/30">
              <summary className="cursor-pointer px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors select-none">
                Variáveis disponíveis ({AVAILABLE_VARIABLES.length}) — clique para inserir
              </summary>
              <div className="px-3 pb-3 flex flex-wrap gap-1">
                {AVAILABLE_VARIABLES.map((v) => (
                  <code
                    key={v.key}
                    title={v.label}
                    className="bg-background border border-border px-1.5 py-0.5 rounded text-[10px] cursor-pointer hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] transition-colors"
                    onClick={() => {
                      const el = document.querySelector<HTMLTextAreaElement>('textarea[name="content"]');
                      if (!el) return;
                      const start = el.selectionStart ?? el.value.length;
                      const end = el.selectionEnd ?? el.value.length;
                      const current = form.getValues("content") ?? "";
                      form.setValue("content", current.slice(0, start) + v.placeholder + current.slice(end));
                      setTimeout(() => { el.focus(); el.setSelectionRange(start + v.placeholder.length, start + v.placeholder.length); }, 0);
                    }}
                  >
                    {v.placeholder}
                  </code>
                ))}
              </div>
            </details>
            <Textarea
              {...form.register("content")}
              placeholder={`CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nPelo presente instrumento...\n\nContratante: {{cliente_nome}}\nValor: {{valor}}\nVigência: {{inicio}} a {{termino}}`}
              rows={14}
              className="font-mono text-xs resize-y"
            />
            {form.formState.errors.content && (
              <p className="text-xs text-destructive">{form.formState.errors.content.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
              {isPending ? "Salvando..." : "Salvar Padrão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
