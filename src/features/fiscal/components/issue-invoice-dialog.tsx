"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertCircle,
  FileText,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIssueFiscalInvoice } from "../hooks/use-fiscal-invoices";
import { useFiscalProfile } from "../hooks/use-fiscal-profile";
import { maskCnpj, maskCpf } from "../utils/document-masks";
import { MunicipioCombobox } from "./municipio-combobox";

const UF_OPTIONS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const NATUREZA_OPERACAO_OPTIONS = [
  { value: "1", label: "1 – Tributação no município" },
  { value: "2", label: "2 – Tributação fora do município" },
  { value: "3", label: "3 – Isenção" },
  { value: "4", label: "4 – Imune" },
  { value: "5", label: "5 – Exigibilidade suspensa por decisão judicial" },
  { value: "6", label: "6 – Exigibilidade suspensa por proc. administrativo" },
] as const;

const REGIME_ESPECIAL_OPTIONS = [
  { value: "1", label: "1 – Microempresa municipal" },
  { value: "2", label: "2 – Estimativa" },
  { value: "3", label: "3 – Sociedade de profissionais" },
  { value: "4", label: "4 – Cooperativa" },
  { value: "5", label: "5 – Microempresário individual (MEI)" },
  { value: "6", label: "6 – Microempresário e EPP (ME EPP)" },
] as const;

const schema = z
  .object({
    tipoTomador: z.enum(["PF", "PJ"]),
    environment: z.enum(["HOMOLOGACAO", "PRODUCAO"]),
    dataCompetencia: z.string().min(1, "Competência obrigatória"),
    discriminacao: z.string().optional(),
    naturezaOperacao: z.string(),
    regimeEspecialTributacao: z.string().optional(),
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

function detectTipoTomador(document?: string | null): "PF" | "PJ" {
  const digits = (document ?? "").replace(/\D/g, "");
  return digits.length === 11 ? "PF" : "PJ";
}

function formatCompetencia(value: string) {
  const [year, month] = value.split("-");
  return month && year ? `${month}/${year}` : value;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function PreviewRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function PreviewCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-0.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
        {title}
      </p>
      {children}
    </div>
  );
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

  const detectedTipo = detectTipoTomador(clientData?.document);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipoTomador: detectedTipo,
      environment: "HOMOLOGACAO" as const,
      dataCompetencia: currentMonthValue(),
      discriminacao: "",
      naturezaOperacao: "1",
      regimeEspecialTributacao: undefined,
      tomadorCnpj: detectedTipo === "PJ" ? (clientData?.document ?? "") : "",
      tomadorRazaoSocial: detectedTipo === "PJ" ? (clientData?.name ?? "") : "",
      tomadorEmail: clientData?.email ?? "",
      tomadorLogradouro: "",
      tomadorNumero: "",
      tomadorComplemento: "",
      tomadorBairro: "",
      tomadorCodigoMunicipio: "",
      tomadorUf: "",
      tomadorCep: "",
      tomadorCpf: detectedTipo === "PF" ? (clientData?.document ?? "") : "",
      tomadorNome: detectedTipo === "PF" ? (clientData?.name ?? "") : "",
    },
  });

  const tipoTomador = form.watch("tipoTomador");
  const environment = form.watch("environment");
  const [step, setStep] = useState<"form" | "preview">("form");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [preflightErrors, setPreflightErrors] = useState<string[]>([]);
  const [municipioDisplay, setMunicipioDisplay] = useState("");

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

  const handleReview = async () => {
    const isValid = await form.trigger();
    if (isValid) setStep("preview");
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await issue.mutateAsync({
        contractId,
        tipoTomador: values.tipoTomador,
        environment: values.environment,
        dataCompetencia: `${values.dataCompetencia}-01`,
        discriminacao: values.discriminacao || undefined,
        naturezaOperacao: values.naturezaOperacao,
        regimeEspecialTributacao: values.regimeEspecialTributacao
          ? Number(values.regimeEspecialTributacao)
          : undefined,
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

  const formErrors = form.formState.errors;

  const naturezaLabel =
    NATUREZA_OPERACAO_OPTIONS.find(
      (opt) => opt.value === form.watch("naturezaOperacao"),
    )?.label ?? "—";

  const regimeLabel =
    REGIME_ESPECIAL_OPTIONS.find(
      (opt) => opt.value === form.watch("regimeEspecialTributacao"),
    )?.label ?? "Nenhum";

  const values = form.getValues();

  const tomadorEnderecoCompleto = [
    values.tomadorLogradouro,
    values.tomadorNumero,
    values.tomadorComplemento,
    values.tomadorBairro,
    values.tomadorCep,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
          setStep("form");
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-[#7C3AED]" />
            Emitir NFS-e — Contrato #{String(contractNumber).padStart(4, "0")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground pt-0.5">
            {step === "form"
              ? "Passo 1 de 2 — Preenchimento"
              : "Passo 2 de 2 — Revisão"}
          </p>
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

        {/* ── STEP 1: Formulário ─────────────────────────────────────── */}
        {step === "form" && (
          <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
            {/* Ambiente de emissão */}
            <div className="space-y-2">
              <Label>Tipo de nota</Label>
              <RadioGroup
                value={environment}
                onValueChange={(v) =>
                  form.setValue("environment", v as "HOMOLOGACAO" | "PRODUCAO")
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="HOMOLOGACAO" id="env-homologacao" />
                  <Label htmlFor="env-homologacao">Homologação</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="PRODUCAO" id="env-producao" />
                  <Label htmlFor="env-producao">Produção (fiscal)</Label>
                </div>
              </RadioGroup>
              {environment === "PRODUCAO" && (
                <p className="text-xs text-amber-600 font-medium">
                  Atenção: notas em produção têm validade fiscal real.
                </p>
              )}
            </div>

            {/* Tipo de tomador */}
            <div className="space-y-2">
              <Label>Tipo de Tomador</Label>
              <RadioGroup
                value={tipoTomador}
                onValueChange={(v) =>
                  form.setValue("tipoTomador", v as "PF" | "PJ", {
                    shouldValidate: true,
                  })
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

            {/* Dados obrigatórios do tomador */}
            {tipoTomador === "PJ" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    CNPJ <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    {...form.register("tomadorCnpj")}
                    onChange={(e) => {
                      const masked = maskCnpj(e.target.value);
                      form.setValue("tomadorCnpj", masked, {
                        shouldValidate: form.formState.isSubmitted,
                      });
                    }}
                    placeholder="XX.XXX.XXX/XXXX-XX"
                  />
                  <FieldError message={formErrors.tomadorCnpj?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Razão Social <span className="text-destructive">*</span>
                  </Label>
                  <Input {...form.register("tomadorRazaoSocial")} />
                  <FieldError
                    message={formErrors.tomadorRazaoSocial?.message}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>
                    Município <span className="text-destructive">*</span>
                  </Label>
                  <MunicipioCombobox
                    displayValue={municipioDisplay}
                    onSelect={(municipio) => {
                      form.setValue(
                        "tomadorCodigoMunicipio",
                        municipio.codigo_ibge,
                        {
                          shouldValidate: true,
                        },
                      );
                      form.setValue("tomadorUf", municipio.uf);
                      setMunicipioDisplay(
                        `${municipio.nome} — ${municipio.uf}`,
                      );
                    }}
                    placeholder="Buscar município pelo nome..."
                  />
                  <FieldError
                    message={formErrors.tomadorCodigoMunicipio?.message}
                  />
                  {form.watch("tomadorCodigoMunicipio") && (
                    <p className="text-xs text-muted-foreground">
                      Código IBGE: {form.watch("tomadorCodigoMunicipio")}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>UF</Label>
                  <Controller
                    control={form.control}
                    name="tomadorUf"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {UF_OPTIONS.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    CPF <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    {...form.register("tomadorCpf")}
                    onChange={(e) => {
                      const masked = maskCpf(e.target.value);
                      form.setValue("tomadorCpf", masked, {
                        shouldValidate: form.formState.isSubmitted,
                      });
                    }}
                    placeholder="000.000.000-00"
                  />
                  <FieldError message={formErrors.tomadorCpf?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Nome Completo <span className="text-destructive">*</span>
                  </Label>
                  <Input {...form.register("tomadorNome")} />
                  <FieldError message={formErrors.tomadorNome?.message} />
                </div>
              </div>
            )}

            <Separator />

            {/* Serviço */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Competência <span className="text-destructive">*</span>
                </Label>
                <Input {...form.register("dataCompetencia")} type="month" />
                <FieldError message={formErrors.dataCompetencia?.message} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Discriminação do serviço</Label>
                <Textarea
                  {...form.register("discriminacao")}
                  placeholder={
                    profile?.defaultDiscriminacao ??
                    "Descreva os serviços prestados (opcional)..."
                  }
                  rows={2}
                />
              </div>
            </div>

            {/* Seção avançada */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors"
                >
                  <span>Avançado</span>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform duration-200",
                      advancedOpen && "rotate-180",
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Natureza da Operação</Label>
                    <Controller
                      control={form.control}
                      name="naturezaOperacao"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {NATUREZA_OPERACAO_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Regime Especial de Tributação</Label>
                    <Controller
                      control={form.control}
                      name="regimeEspecialTributacao"
                      render={({ field }) => (
                        <Select
                          value={field.value ?? "_none"}
                          onValueChange={(v) =>
                            field.onChange(v === "_none" ? undefined : v)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Nenhum (padrão do perfil)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">
                              Nenhum (padrão do perfil)
                            </SelectItem>
                            {REGIME_ESPECIAL_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Contato e endereço do tomador
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input
                      {...form.register("tomadorEmail")}
                      type="email"
                      placeholder="tomador@exemplo.com"
                    />
                  </div>

                  {tipoTomador === "PJ" && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Logradouro</Label>
                        <Input
                          {...form.register("tomadorLogradouro")}
                          placeholder="Rua Exemplo"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Número</Label>
                        <Input
                          {...form.register("tomadorNumero")}
                          placeholder="100"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Complemento</Label>
                        <Input
                          {...form.register("tomadorComplemento")}
                          placeholder="Sala 201"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bairro</Label>
                        <Input {...form.register("tomadorBairro")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>CEP</Label>
                        <Input
                          {...form.register("tomadorCep")}
                          placeholder="00000-000"
                        />
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={preflightErrors.length > 0}
                onClick={handleReview}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
              >
                Revisar <ArrowRight className="size-4 ml-1" />
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* ── STEP 2: Preview ────────────────────────────────────────── */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Prestador */}
              <PreviewCard title="Prestador (emitente)">
                <PreviewRow label="Razão Social" value={profile?.razaoSocial} />
                <PreviewRow
                  label="CNPJ"
                  value={maskCnpj(profile?.cnpj ?? "")}
                />
                <PreviewRow
                  label="Inscrição Municipal"
                  value={profile?.inscricaoMunicipal}
                />
                <PreviewRow
                  label="Município"
                  value={
                    profile?.municipio && profile.uf
                      ? `${profile.municipio} — ${profile.uf}`
                      : profile?.municipio
                  }
                />
                <PreviewRow
                  label="Cód. IBGE"
                  value={profile?.codigoMunicipio}
                />
                <PreviewRow
                  label="Simples Nacional"
                  value={profile?.optanteSimplesNacional ? "Sim" : "Não"}
                />
              </PreviewCard>

              {/* Tomador */}
              <PreviewCard title="Tomador (destinatário)">
                {values.tipoTomador === "PJ" ? (
                  <>
                    <PreviewRow label="Tipo" value="Pessoa Jurídica" />
                    <PreviewRow
                      label="Razão Social"
                      value={values.tomadorRazaoSocial}
                    />
                    <PreviewRow label="CNPJ" value={values.tomadorCnpj} />
                    <PreviewRow
                      label="Município"
                      value={
                        municipioDisplay ||
                        (values.tomadorCodigoMunicipio
                          ? `Cód. ${values.tomadorCodigoMunicipio}`
                          : undefined)
                      }
                    />
                    {values.tomadorEmail && (
                      <PreviewRow label="E-mail" value={values.tomadorEmail} />
                    )}
                    {tomadorEnderecoCompleto && (
                      <PreviewRow
                        label="Endereço"
                        value={tomadorEnderecoCompleto}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <PreviewRow label="Tipo" value="Pessoa Física" />
                    <PreviewRow label="Nome" value={values.tomadorNome} />
                    <PreviewRow label="CPF" value={values.tomadorCpf} />
                    {values.tomadorEmail && (
                      <PreviewRow label="E-mail" value={values.tomadorEmail} />
                    )}
                  </>
                )}
              </PreviewCard>
            </div>

            {/* Serviço */}
            <PreviewCard title="Serviço">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <div>
                  <PreviewRow
                    label="Valor"
                    value={fmtCurrency(contractValue)}
                  />
                  <PreviewRow
                    label="Competência"
                    value={formatCompetencia(values.dataCompetencia)}
                  />
                  <PreviewRow
                    label="Alíquota ISS"
                    value={
                      profile
                        ? `${Number(profile.defaultAliquotaIss).toFixed(2)}%`
                        : undefined
                    }
                  />
                  <PreviewRow
                    label="ISS Retido"
                    value={profile?.defaultIssRetido ? "Sim" : "Não"}
                  />
                  <PreviewRow
                    label="Item lista serviço"
                    value={profile?.defaultItemListaServico ?? undefined}
                  />
                </div>
                <div>
                  <PreviewRow
                    label="Natureza da Operação"
                    value={naturezaLabel}
                  />
                  <PreviewRow label="Regime Especial" value={regimeLabel} />
                  <PreviewRow
                    label="Ambiente"
                    value={
                      values.environment === "PRODUCAO"
                        ? "Produção"
                        : "Homologação"
                    }
                  />
                  {(values.discriminacao || profile?.defaultDiscriminacao) && (
                    <PreviewRow
                      label="Discriminação"
                      value={
                        values.discriminacao || profile?.defaultDiscriminacao
                      }
                    />
                  )}
                </div>
              </div>
            </PreviewCard>

            {values.environment === "PRODUCAO" && (
              <p className="text-xs text-amber-600 font-medium text-center">
                Atenção: esta nota terá validade fiscal real após emitida.
              </p>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("form")}
              >
                <ArrowLeft className="size-4 mr-1" /> Voltar
              </Button>
              <Button
                type="button"
                disabled={issue.isPending}
                onClick={form.handleSubmit(onSubmit)}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
              >
                {issue.isPending ? "Emitindo..." : "Confirmar e Emitir"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
