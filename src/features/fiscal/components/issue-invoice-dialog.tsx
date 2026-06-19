"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, FileText } from "lucide-react";
import { useIssueFiscalInvoice } from "../hooks/use-fiscal-invoices";
import { useFiscalProfile } from "../hooks/use-fiscal-profile";

const schema = z
  .object({
    tipoTomador: z.enum(["PF", "PJ"]),
    dataCompetencia: z.string().min(1, "Competência obrigatória"),
    discriminacao: z.string().optional(),
    // PJ
    tomadorCnpj: z.string().optional(),
    tomadorRazaoSocial: z.string().optional(),
    tomadorEmail: z.string().optional(),
    tomadorLogradouro: z.string().optional(),
    tomadorNumero: z.string().optional(),
    tomadorComplemento: z.string().optional(),
    tomadorBairro: z.string().optional(),
    tomadorCodigoMunicipio: z.string().optional(),
    tomadorUf: z.string().optional(),
    tomadorCep: z.string().optional(),
    // PF
    tomadorCpf: z.string().optional(),
    tomadorNome: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.tipoTomador === "PJ") {
      const cnpj = (values.tomadorCnpj ?? "").replace(/\D/g, "");
      if (cnpj.length !== 14)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CNPJ do tomador inválido",
          path: ["tomadorCnpj"],
        });
      if (!values.tomadorRazaoSocial)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Razão social obrigatória",
          path: ["tomadorRazaoSocial"],
        });
      if (!values.tomadorCodigoMunicipio)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Código do município obrigatório",
          path: ["tomadorCodigoMunicipio"],
        });
    } else {
      const cpf = (values.tomadorCpf ?? "").replace(/\D/g, "");
      if (cpf.length !== 11)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CPF do tomador inválido",
          path: ["tomadorCpf"],
        });
      if (!values.tomadorNome)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Nome obrigatório",
          path: ["tomadorNome"],
        });
    }
  });

type FormValues = z.infer<typeof schema>;

interface ClientData {
  name?: string | null;
  document?: string | null;
  email?: string | null;
  address?: string | null;
}

interface IssueInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  contractId: string;
  contractNumber: number;
  contractValue: string;
  clientData: ClientData | null;
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function IssueInvoiceDialog({
  open,
  onClose,
  contractId,
  contractNumber,
  contractValue,
  clientData,
}: IssueInvoiceDialogProps) {
  const { data: profileData } = useFiscalProfile();
  const profile = profileData?.profile;
  const issue = useIssueFiscalInvoice();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipoTomador: "PJ",
      dataCompetencia: currentMonthValue(),
      discriminacao: "",
      tomadorCnpj: clientData?.document?.replace(/\D/g, "").length === 14
        ? clientData.document
        : "",
      tomadorRazaoSocial: clientData?.name ?? "",
      tomadorEmail: clientData?.email ?? "",
      tomadorLogradouro: "",
      tomadorNumero: "",
      tomadorComplemento: "",
      tomadorBairro: "",
      tomadorCodigoMunicipio: "",
      tomadorUf: "",
      tomadorCep: "",
      tomadorCpf: clientData?.document?.replace(/\D/g, "").length === 11
        ? clientData.document
        : "",
      tomadorNome: clientData?.name ?? "",
    },
  });

  const tipoTomador = form.watch("tipoTomador");

  const [preflightErrors, setPreflightErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
    const errors: string[] = [];
    if (!profile.supportedByFocus)
      errors.push("Município do prestador não integrado na Focus NFe.");
    if (!profile.focusEmpresaRegistered)
      errors.push("Empresa não cadastrada na Focus NFe.");
    if (!profile.inscricaoMunicipal)
      errors.push("Inscrição municipal não configurada.");
    if (!profile.defaultItemListaServico)
      errors.push("Item lista de serviço não configurado.");
    if (Number(profile.defaultAliquotaIss) <= 0)
      errors.push("Alíquota ISS inválida.");
    if (Number(contractValue) <= 0)
      errors.push("Valor do contrato deve ser maior que zero.");
    setPreflightErrors(errors);
  }, [profile, contractValue]);

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await issue.mutateAsync({
        contractId,
        tipoTomador: values.tipoTomador,
        dataCompetencia: `${values.dataCompetencia}-01`,
        discriminacao: values.discriminacao || undefined,
        tomadorCnpj: values.tomadorCnpj,
        tomadorCpf: values.tomadorCpf,
        tomadorRazaoSocial: values.tomadorRazaoSocial,
        tomadorNome: values.tomadorNome,
        tomadorEmail: values.tomadorEmail,
        tomadorLogradouro: values.tomadorLogradouro,
        tomadorNumero: values.tomadorNumero,
        tomadorComplemento: values.tomadorComplemento,
        tomadorBairro: values.tomadorBairro,
        tomadorCodigoMunicipio: values.tomadorCodigoMunicipio,
        tomadorUf: values.tomadorUf,
        tomadorCep: values.tomadorCep,
      });

      if (result.status === "AUTORIZADO") {
        toast.success("Nota fiscal autorizada!");
      } else if (result.status === "ERRO") {
        toast.error("Erro ao autorizar nota fiscal. Verifique o status.");
      } else {
        toast.success("Nota fiscal enviada para processamento.");
      }
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao emitir nota fiscal";
      toast.error(message);
    }
  };

  const fmtCurrency = (v: string) =>
    Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-[#7C3AED]" />
            Emitir NFS-e — Contrato #{String(contractNumber).padStart(4, "0")}
          </DialogTitle>
        </DialogHeader>

        {preflightErrors.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="size-4" /> Pré-flight com erros
            </div>
            {preflightErrors.map((error, idx) => (
              <p key={idx} className="text-xs text-destructive pl-6">
                • {error}
              </p>
            ))}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Tipo de tomador */}
          <div className="space-y-2">
            <Label>Tipo de Tomador</Label>
            <RadioGroup
              value={tipoTomador}
              onValueChange={(v) =>
                form.setValue("tipoTomador", v as "PF" | "PJ")
              }
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="PJ" id="tipo-pj" />
                <Label htmlFor="tipo-pj">Pessoa Jurídica</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="PF" id="tipo-pf" />
                <Label htmlFor="tipo-pf">Pessoa Física</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Dados do Tomador */}
          {tipoTomador === "PJ" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CNPJ</Label>
                <Input {...form.register("tomadorCnpj")} placeholder="XX.XXX.XXX/XXXX-XX" />
                {form.formState.errors.tomadorCnpj && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.tomadorCnpj.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Razão Social</Label>
                <Input {...form.register("tomadorRazaoSocial")} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input {...form.register("tomadorEmail")} type="email" />
              </div>
              <div className="space-y-1.5">
                <Label>Logradouro</Label>
                <Input {...form.register("tomadorLogradouro")} />
              </div>
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input {...form.register("tomadorNumero")} />
              </div>
              <div className="space-y-1.5">
                <Label>Complemento</Label>
                <Input {...form.register("tomadorComplemento")} />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input {...form.register("tomadorBairro")} />
              </div>
              <div className="space-y-1.5">
                <Label>Código IBGE Município (7 dígitos)</Label>
                <Input {...form.register("tomadorCodigoMunicipio")} placeholder="3550308" />
                {form.formState.errors.tomadorCodigoMunicipio && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.tomadorCodigoMunicipio.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>UF</Label>
                <Input {...form.register("tomadorUf")} maxLength={2} className="w-20" />
              </div>
              <div className="space-y-1.5">
                <Label>CEP</Label>
                <Input {...form.register("tomadorCep")} placeholder="00000-000" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input {...form.register("tomadorCpf")} placeholder="000.000.000-00" />
                {form.formState.errors.tomadorCpf && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.tomadorCpf.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Nome Completo</Label>
                <Input {...form.register("tomadorNome")} />
                {form.formState.errors.tomadorNome && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.tomadorNome.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input {...form.register("tomadorEmail")} type="email" />
              </div>
            </div>
          )}

          <Separator />

          {/* Dados do serviço */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Competência (mês/ano)</Label>
              <Input
                {...form.register("dataCompetencia")}
                type="month"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Discriminação do serviço</Label>
              <Textarea
                {...form.register("discriminacao")}
                placeholder={
                  profile?.defaultDiscriminacao ??
                  "Descreva os serviços prestados..."
                }
                rows={2}
              />
            </div>
          </div>

          {/* Resumo */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              Resumo da nota
            </p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor</span>
              <span className="font-semibold">{fmtCurrency(contractValue)}</span>
            </div>
            {profile && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alíquota ISS</span>
                  <span>
                    {(Number(profile.defaultAliquotaIss) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ISS Retido</span>
                  <span>{profile.defaultIssRetido ? "Sim" : "Não"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ambiente</span>
                  <Badge
                    className={
                      profile.environment === "PRODUCAO"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"
                        : "bg-amber-100 text-amber-700 border-amber-200 text-[10px]"
                    }
                  >
                    {profile.environment === "PRODUCAO"
                      ? "Produção"
                      : "Homologação"}
                  </Badge>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={issue.isPending || preflightErrors.length > 0}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
            >
              {issue.isPending ? "Emitindo..." : "Emitir Nota Fiscal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
