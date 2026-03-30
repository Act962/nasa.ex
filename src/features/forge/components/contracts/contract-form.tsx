"use client";

import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useCreateForgeContract, useUpdateForgeContract, useForgeTemplates, useForgeProposals } from "../../hooks/use-forge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  proposalId: z.string().optional(),
  startDate: z.string().min(1, "Data de início obrigatória"),
  endDate: z.string().min(1, "Data de término obrigatória"),
  value: z.string().min(1, "Valor obrigatório"),
  templateId: z.string().optional(),
  content: z.string().optional(),
  signers: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    whatsapp: z.string().optional(),
  })).default([]),
});

type FormData = z.infer<typeof schema>;

interface ContractFormProps {
  open: boolean;
  onClose: () => void;
  contractId?: string;
  // Pre-fill from proposal
  initialProposalId?: string;
  initialValue?: string;
  initialClientName?: string;
  initialClientEmail?: string;
}

export function ContractForm({
  open,
  onClose,
  contractId,
  initialProposalId,
  initialValue,
  initialClientName,
  initialClientEmail,
}: ContractFormProps) {
  const create = useCreateForgeContract();
  const update = useUpdateForgeContract();
  const { data: templatesData } = useForgeTemplates();
  const { data: proposalsData } = useForgeProposals();

  const { data: existingData } = useQuery({
    ...orpc.forge.contracts.list.queryOptions({ input: {} }),
    enabled: !!contractId,
    select: (d) => d.contracts.find((c) => c.id === contractId),
  });

  const form = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      signers: initialClientName && initialClientEmail
        ? [{ name: initialClientName, email: initialClientEmail, whatsapp: "" }]
        : [],
      value: initialValue ?? "",
      proposalId: initialProposalId,
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "signers" });

  const selectedTemplate = form.watch("templateId");
  const templates = templatesData?.templates ?? [];

  // When template is selected, auto-fill content and dates
  useEffect(() => {
    if (selectedTemplate) {
      const tpl = templates.find((t) => t.id === selectedTemplate);
      if (tpl) {
        form.setValue("content", tpl.content);
        if (tpl.defaultStartDate) {
          form.setValue("startDate", new Date(tpl.defaultStartDate).toISOString().split("T")[0]);
        }
        if (tpl.defaultEndDate) {
          form.setValue("endDate", new Date(tpl.defaultEndDate).toISOString().split("T")[0]);
        }
      }
    }
  }, [selectedTemplate]);

  // Load existing contract data when editing
  useEffect(() => {
    if (existingData) {
      const c = existingData as {
        proposalId?: string | null;
        startDate: string | Date;
        endDate: string | Date;
        value: string | number;
        templateId?: string | null;
        content?: string | null;
        signers?: unknown[];
      };
      form.reset({
        proposalId: c.proposalId ?? undefined,
        startDate: new Date(c.startDate).toISOString().split("T")[0],
        endDate: new Date(c.endDate).toISOString().split("T")[0],
        value: String(c.value),
        templateId: c.templateId ?? undefined,
        content: c.content ?? "",
        signers: Array.isArray(c.signers)
          ? (c.signers as { name: string; email: string; whatsapp?: string }[]).map((s) => ({
              name: s.name ?? "",
              email: s.email ?? "",
              whatsapp: s.whatsapp ?? "",
            }))
          : [],
      });
    }
  }, [existingData]);

  const onSubmit = async (data: FormData) => {
    try {
      if (contractId) {
        await update.mutateAsync({ id: contractId, ...data });
        toast.success("Contrato atualizado");
      } else {
        await create.mutateAsync(data);
        toast.success("Contrato criado");
      }
      onClose();
    } catch {
      toast.error("Erro ao salvar contrato");
    }
  };

  const isPending = create.isPending || update.isPending;
  const proposals = proposalsData?.proposals ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {contractId ? "Editar Contrato" : initialProposalId ? "Gerar Contrato" : "Novo Contrato"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Template selector */}
          {templates.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Padrão de Contrato</h3>
              <div className="space-y-1.5">
                <Label>Modelo</Label>
                <Select value={form.watch("templateId") ?? ""} onValueChange={(v) => form.setValue("templateId", v || undefined)}>
                  <SelectTrigger><SelectValue placeholder="Selecione um padrão..." /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Ao selecionar, o texto e as datas padrão do modelo serão preenchidos automaticamente.
                </p>
              </div>
            </div>
          )}

          {templates.length > 0 && <Separator />}

          {/* Datas e Valor */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Início *</Label>
                <Input type="date" {...form.register("startDate")} />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Término *</Label>
                <Input type="date" {...form.register("endDate")} />
                {form.formState.errors.endDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.endDate.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Valor *</Label>
                <Input {...form.register("value")} type="number" step="0.01" min="0" placeholder="0,00" />
                {form.formState.errors.value && (
                  <p className="text-xs text-destructive">{form.formState.errors.value.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Proposta vinculada {initialProposalId ? "" : "(opcional)"}</Label>
              <Select
                value={form.watch("proposalId") ?? ""}
                onValueChange={(v) => form.setValue("proposalId", v || undefined)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {proposals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      #{String(p.number).padStart(4, "0")} — {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Conteúdo */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Conteúdo</h3>
            <div className="space-y-1.5">
              <Label>Texto do Contrato</Label>
              <Textarea
                {...form.register("content")}
                placeholder="Conteúdo do contrato... Use variáveis como {{cliente_nome}}, {{empresa_nome}}, {{valor}}, {{inicio}}, {{termino}}"
                rows={8}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <Separator />

          {/* Assinantes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Assinantes</h3>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => append({ name: "", email: "", whatsapp: "" })}>
                <Plus className="size-3.5" /> Adicionar
              </Button>
            </div>

            {fields.length === 0 ? (
              <div className="border border-dashed rounded-lg py-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <UserCheck className="size-4" /> Nenhum assinante adicionado
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-[1fr_1fr_120px_32px] gap-2 items-start">
                    <Input {...form.register(`signers.${index}.name`)} placeholder="Nome" className="h-8 text-xs" />
                    <Input {...form.register(`signers.${index}.email`)} placeholder="Email" className="h-8 text-xs" />
                    <Input {...form.register(`signers.${index}.whatsapp`)} placeholder="WhatsApp" className="h-8 text-xs" />
                    <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => remove(index)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_1fr_120px_32px] gap-2 text-[10px] text-muted-foreground px-0.5">
                  <span>Nome</span><span>Email</span><span>WhatsApp</span><span />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
              {isPending ? "Salvando..." : contractId ? "Salvar Contrato" : "Criar Contrato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
