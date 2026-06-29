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
import { Plus, Trash2, UserCheck, Download } from "lucide-react";
import { toast } from "sonner";
import { AVAILABLE_VARIABLES } from "../../utils/render-template";

const schema = z
  .object({
    proposalId: z.string().optional(),
    startDate: z.string().min(1, "Data de início obrigatória"),
    endDate: z.string().min(1, "Data de término obrigatória"),
    value: z.string().min(1, "Valor obrigatório"),
    templateId: z.string().optional(),
    content: z.string().min(20, "Texto do contrato muito curto (mínimo 20 caracteres)"),
    clientData: z
      .object({
        name: z.string().optional(),
        document: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        contactName: z.string().optional(),
      })
      .optional(),
    signers: z.array(z.object({
      name: z.string().min(1, "Nome do assinante obrigatório"),
      email: z.string().email("E-mail do assinante inválido"),
      whatsapp: z.string().optional(),
      token: z.string().optional(),
      signed_at: z.string().nullable().optional(),
      sign_method: z.string().optional(),
    })).min(1, "Adicione ao menos 1 assinante"),
  })
  .refine(
    (d) => !d.startDate || !d.endDate || new Date(d.endDate) >= new Date(d.startDate),
    { path: ["endDate"], message: "Término deve ser igual ou posterior ao início" },
  );

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
        clientData?: {
          name?: string | null;
          document?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          contactName?: string | null;
        } | null;
      };
      form.reset({
        proposalId: c.proposalId ?? undefined,
        startDate: new Date(c.startDate).toISOString().split("T")[0],
        endDate: new Date(c.endDate).toISOString().split("T")[0],
        value: String(c.value),
        templateId: c.templateId ?? undefined,
        content: c.content ?? "",
        clientData: c.clientData
          ? {
              name: c.clientData.name ?? "",
              document: c.clientData.document ?? "",
              email: c.clientData.email ?? "",
              phone: c.clientData.phone ?? "",
              address: c.clientData.address ?? "",
              contactName: c.clientData.contactName ?? "",
            }
          : undefined,
        signers: Array.isArray(c.signers)
          ? (c.signers as {
              name: string;
              email: string;
              whatsapp?: string;
              token?: string;
              signed_at?: string | null;
              sign_method?: string;
            }[]).map((s) => ({
              name: s.name ?? "",
              email: s.email ?? "",
              whatsapp: s.whatsapp ?? "",
              token: s.token,
              signed_at: s.signed_at ?? null,
              sign_method: s.sign_method,
            }))
          : [],
      });
    }
  }, [existingData]);

  // Auto-fill clientData from linked proposal's lead (if clientData is empty)
  const proposalIdWatch = form.watch("proposalId");
  useEffect(() => {
    if (!proposalIdWatch) return;
    const proposal = proposalsData?.proposals.find((p) => p.id === proposalIdWatch);
    if (!proposal?.client) return;
    const current = form.getValues("clientData");
    const isEmpty =
      !current ||
      (!current.name && !current.email && !current.phone && !current.document && !current.address);
    if (isEmpty) {
      form.setValue("clientData", {
        name: proposal.client.name ?? "",
        document: proposal.client.document ?? "",
        email: proposal.client.email ?? "",
        phone: proposal.client.phone ?? "",
        address: "",
        contactName: "",
      }, { shouldDirty: false });
    }
  }, [proposalIdWatch, proposalsData]);

  const importFromProposal = () => {
    const pid = form.getValues("proposalId");
    if (!pid) {
      toast.info("Vincule uma proposta para importar dados do cliente");
      return;
    }
    const proposal = proposalsData?.proposals.find((p) => p.id === pid);
    if (!proposal?.client) {
      toast.info("Proposta sem cliente vinculado");
      return;
    }
    form.setValue("clientData", {
      name: proposal.client.name ?? "",
      document: proposal.client.document ?? "",
      email: proposal.client.email ?? "",
      phone: proposal.client.phone ?? "",
      address: form.getValues("clientData.address") ?? "",
      contactName: form.getValues("clientData.contactName") ?? "",
    }, { shouldDirty: true });
    toast.success("Dados importados do Lead vinculado");
  };

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
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err && "message" in err
            ? String((err as { message: unknown }).message)
            : "Erro ao salvar contrato";
      toast.error(msg);
    }
  };

  const onInvalid = (errs: typeof form.formState.errors) => {
    const firstField = Object.keys(errs)[0];
    if (!firstField) return;
    const err = errs[firstField as keyof typeof errs];
    const message =
      (err as { message?: string } | undefined)?.message ??
      (Array.isArray(err) && err.length
        ? (err.find((e) => e?.message) as { message?: string } | undefined)?.message
        : undefined) ??
      "Verifique os campos destacados";
    toast.error(message ?? "Verifique os campos destacados");
  };

  // Stage do contrato (derivado de signers existentes — só faz sentido em edit)
  const existingSigners = (existingData?.signers as { signed_at?: string | null }[] | undefined) ?? [];
  const anySigned = existingSigners.some((s) => s.signed_at);
  const allSigned = anySigned && existingSigners.every((s) => s.signed_at);
  const stage: "draft" | "partially-signed" | "fully-signed" = allSigned
    ? "fully-signed"
    : anySigned
      ? "partially-signed"
      : "draft";
  const isPartiallySigned = stage === "partially-signed";
  const isFullySigned = stage === "fully-signed";
  const isLocked = isPartiallySigned || isFullySigned;

  const watched = form.watch();
  const checklist: { label: string; ok: boolean }[] = [
    { label: "Data de início", ok: !!watched.startDate },
    { label: "Data de término", ok: !!watched.endDate },
    { label: "Valor", ok: !!watched.value },
    { label: "Texto do contrato (≥20 caracteres)", ok: (watched.content ?? "").length >= 20 },
    { label: "Pelo menos 1 assinante", ok: (watched.signers ?? []).length >= 1 },
  ];
  const pending = checklist.filter((i) => !i.ok);

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

        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
          {isFullySigned && (
            <div className="rounded-lg border border-neutral-300 bg-neutral-50 dark:bg-neutral-900/40 dark:border-neutral-700 px-4 py-3 text-xs">
              <p className="font-semibold text-neutral-700 dark:text-neutral-200">
                Contrato finalizado
              </p>
              <p className="text-neutral-600 dark:text-neutral-400 mt-0.5">
                Todos os assinantes já assinaram. O contrato está em modo somente leitura.
              </p>
            </div>
          )}
          {isPartiallySigned && (
            <div className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/50 px-4 py-3 text-xs">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Contrato em assinatura — edição limitada
              </p>
              <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                Algum assinante já assinou. Apenas a data de término pode ser alterada — texto, valor, signers e início estão bloqueados.
              </p>
            </div>
          )}
          {!isLocked && pending.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/50 px-4 py-3 text-xs">
              <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1.5">
                Pendências antes de salvar
              </p>
              <ul className="space-y-0.5 text-amber-800 dark:text-amber-300">
                {checklist.map((item) => (
                  <li key={item.label} className="flex items-center gap-2">
                    <span className={item.ok ? "text-emerald-600" : "text-amber-700"}>
                      {item.ok ? "✓" : "□"}
                    </span>
                    <span className={item.ok ? "line-through opacity-60" : ""}>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                <Input type="date" {...form.register("startDate")} disabled={isLocked} />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Término *</Label>
                <Input type="date" {...form.register("endDate")} disabled={isFullySigned} />
                {form.formState.errors.endDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.endDate.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Valor *</Label>
                <Input {...form.register("value")} type="number" step="0.01" min="0" placeholder="0,00" disabled={isLocked} />
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

          {/* Dados do Contratante */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados do Contratante</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={importFromProposal}
              >
                <Download className="size-3.5" /> Importar do Lead
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Substitui as variáveis <code>{`{{cliente_*}}`}</code> no contrato. Se houver proposta vinculada, será preenchido automaticamente — mas você pode sobrescrever manualmente.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome / Razão Social</Label>
                <Input {...form.register("clientData.name")} placeholder="João da Silva" className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CNPJ / CPF</Label>
                <Input {...form.register("clientData.document")} placeholder="00.000.000/0001-00" className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail</Label>
                <Input {...form.register("clientData.email")} placeholder="contato@cliente.com" className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input {...form.register("clientData.phone")} placeholder="(11) 90000-0000" className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Endereço completo</Label>
                <Input {...form.register("clientData.address")} placeholder="Rua, número, bairro, cidade/UF — CEP" className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Pessoa de contato (opcional)</Label>
                <Input {...form.register("clientData.contactName")} placeholder="Nome do interlocutor" className="h-9 text-xs" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Conteúdo */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Conteúdo</h3>
            <div className="space-y-1.5">
              <Label>Texto do Contrato *</Label>
              <details className="group rounded-md border border-border/60 bg-muted/30">
                <summary className="cursor-pointer px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors select-none">
                  Variáveis disponíveis ({AVAILABLE_VARIABLES.length}) — clique para inserir no texto
                </summary>
                <div className="px-3 pb-3 flex flex-wrap gap-1">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <code
                      key={v.key}
                      title={v.label}
                      className="bg-background border border-border px-1.5 py-0.5 rounded text-[10px] cursor-pointer hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] transition-colors"
                      onClick={() => {
                        if (isLocked) return;
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
                placeholder="Conteúdo do contrato... Use variáveis como {{cliente_nome}}, {{empresa_nome}}, {{valor}}, {{inicio}}, {{termino}}"
                rows={8}
                className="font-mono text-xs"
                disabled={isLocked}
              />
              {form.formState.errors.content && (
                <p className="text-xs text-destructive">{form.formState.errors.content.message}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Assinantes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Assinantes</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={isLocked}
                onClick={() => append({ name: "", email: "", whatsapp: "" })}
              >
                <Plus className="size-3.5" /> Adicionar
              </Button>
            </div>

            {fields.length === 0 ? (
              <div className="border border-dashed rounded-lg py-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <UserCheck className="size-4" /> Nenhum assinante adicionado
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((field, index) => {
                  const isSigned = !!form.getValues(`signers.${index}.signed_at`);
                  const fieldDisabled = isLocked || isSigned;
                  return (
                    <div key={field.id} className="grid grid-cols-[1fr_1fr_120px_32px] gap-2 items-start">
                      <Input {...form.register(`signers.${index}.name`)} placeholder="Nome" className="h-8 text-xs" disabled={fieldDisabled} />
                      <Input {...form.register(`signers.${index}.email`)} placeholder="Email" className="h-8 text-xs" disabled={fieldDisabled} />
                      <Input {...form.register(`signers.${index}.whatsapp`)} placeholder="WhatsApp" className="h-8 text-xs" disabled={fieldDisabled} />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive"
                        disabled={fieldDisabled}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  );
                })}
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
