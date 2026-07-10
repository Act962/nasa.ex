"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useForm, Controller, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
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
import { Switch } from "@/components/ui/switch";
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
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useIssueFiscalInvoice,
  useIssueFiscalInvoiceFromPaymentEntry,
} from "../hooks/use-fiscal-invoices";
import { useFiscalProfile } from "../hooks/use-fiscal-profile";
import { maskCnpj, maskCpf } from "../utils/document-masks";
import {
  UF_OPTIONS,
  TAXATION_TYPE_OPTIONS,
  NATUREZA_OPERACAO_OPTIONS,
  REGIME_ESPECIAL_OPTIONS,
} from "../lib/issue-invoice-options";
import { resolveMunicipioRequirements } from "../lib/municipio-requirements";
import {
  issueInvoiceSchema,
  type IssueInvoiceFormValues,
} from "../schemas/issue-invoice-schema";
import { MunicipioCombobox } from "./municipio-combobox";
import type { CnpjWsResponse } from "@/http/cnpj-ws/client";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Sao_Paulo";

// Sentinel do Select de regime especial: "usar o que está cadastrado no perfil"
// (Radix Select não aceita valor vazio, então precisamos de um marcador explícito).
const REGIME_PROFILE_DEFAULT = "__profile__";

interface ClientData {
  name?: string | null;
  document?: string | null;
  email?: string | null;
  address?: string | null;
}

// Origem da emissão — o dialog é agnóstico de domínio; contract e payment-entry
// só diferem na mutation chamada e no título exibido.
export type FiscalIssueTarget =
  | { kind: "contract"; contractId: string; contractNumber: number }
  | { kind: "payment-entry"; paymentEntryId: string; label: string };

interface IssueInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  target: FiscalIssueTarget;
  serviceValue: string;
  clientData: ClientData | null;
}

// Data-mês-ano (dia+mês+ano) da competência, sempre ancorada em horário de
// Brasília — evita que o dia mude por conta do fuso da máquina renderizando.
function currentCompetenciaValue() {
  return dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
}

function detectTipoTomador(document?: string | null): "PF" | "PJ" {
  const digits = (document ?? "").replace(/\D/g, "");
  return digits.length === 11 ? "PF" : "PJ";
}

// Converte o input percentual (string) em número; 0/ausente/invalido → undefined
// para não sobrescrever o padrão do perfil com um valor vazio.
function toPercentNumber(value?: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatCompetencia(value: string) {
  const competencia = dayjs.tz(value, TIMEZONE);
  return competencia.isValid() ? competencia.format("DD/MM/YYYY") : value;
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

function TomadorEnderecoFields({
  form,
  municipioDisplay,
  onMunicipioDisplayChange,
  required,
}: {
  form: UseFormReturn<IssueInvoiceFormValues>;
  municipioDisplay: string;
  onMunicipioDisplayChange: (value: string) => void;
  required: boolean;
}) {
  const formErrors = form.formState.errors;
  const requiredMark = required ? (
    <span className="text-destructive">*</span>
  ) : null;

  return (
    <>
      <div className="sm:col-span-2 space-y-1.5">
        <Label>Município {requiredMark}</Label>
        <MunicipioCombobox
          displayValue={municipioDisplay}
          onSelect={(municipio) => {
            form.setValue("tomadorCodigoMunicipio", municipio.codigo_ibge, {
              shouldValidate: true,
            });
            form.setValue("tomadorMunicipio", municipio.nome);
            form.setValue("tomadorUf", municipio.uf);
            onMunicipioDisplayChange(`${municipio.nome} — ${municipio.uf}`);
          }}
          placeholder="Buscar município pelo nome..."
        />
        <FieldError message={formErrors.tomadorCodigoMunicipio?.message} />
        {form.watch("tomadorCodigoMunicipio") && (
          <p className="text-xs text-muted-foreground">
            Código IBGE: {form.watch("tomadorCodigoMunicipio")}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>UF {requiredMark}</Label>
        <Controller
          control={form.control}
          name="tomadorUf"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
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
        <FieldError message={formErrors.tomadorUf?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>Logradouro {requiredMark}</Label>
        <Input
          {...form.register("tomadorLogradouro")}
          placeholder="Rua Exemplo"
        />
        <FieldError message={formErrors.tomadorLogradouro?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>Número {requiredMark}</Label>
        <Input {...form.register("tomadorNumero")} placeholder="100" />
        <FieldError message={formErrors.tomadorNumero?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>Complemento</Label>
        <Input
          {...form.register("tomadorComplemento")}
          placeholder="Sala 201"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Bairro {requiredMark}</Label>
        <Input {...form.register("tomadorBairro")} />
        <FieldError message={formErrors.tomadorBairro?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>CEP {requiredMark}</Label>
        <Input {...form.register("tomadorCep")} placeholder="00000-000" />
        <FieldError message={formErrors.tomadorCep?.message} />
      </div>
    </>
  );
}

export function IssueInvoiceDialog({
  open,
  onClose,
  target,
  serviceValue,
  clientData,
}: IssueInvoiceDialogProps) {
  const { data: profileData } = useFiscalProfile();
  const profile = profileData?.profile;
  const issueFromContract = useIssueFiscalInvoice();
  const issueFromPaymentEntry = useIssueFiscalInvoiceFromPaymentEntry();
  const issue =
    target.kind === "contract" ? issueFromContract : issueFromPaymentEntry;

  const detectedTipo = detectTipoTomador(clientData?.document);

  const form = useForm<IssueInvoiceFormValues>({
    resolver: zodResolver(issueInvoiceSchema),
    defaultValues: {
      tipoTomador: detectedTipo,
      environment: "HOMOLOGACAO" as const,
      nfseStandard: undefined,
      dataCompetencia: currentCompetenciaValue(),
      discriminacao: "",
      naturezaOperacao: "1",
      regimeEspecialTributacao: REGIME_PROFILE_DEFAULT,
      ibsCbsSituacaoTributaria: "",
      ibsCbsClassificacaoTributaria: "",
      consumidorFinal: false,
      issRetido: false,
      irPercent: "0",
      pisPercent: "0",
      cofinsPercent: "0",
      csllPercent: "0",
      inssPercent: "0",
      outrasRetencoesPercent: "0",
      deducoesPercent: "0",
      descontoIncondicionadoPercent: "0",
      descontoCondicionadoPercent: "0",
      informacoesAdicionais: "",
      tomadorInscricaoMunicipal: "",
      cityServiceCode: "",
      taxationType: "WithinCity",
      tomadorCnpj: detectedTipo === "PJ" ? (clientData?.document ?? "") : "",
      tomadorRazaoSocial: detectedTipo === "PJ" ? (clientData?.name ?? "") : "",
      tomadorEmail: clientData?.email ?? "",
      tomadorLogradouro: "",
      tomadorNumero: "",
      tomadorComplemento: "",
      tomadorBairro: "",
      tomadorCodigoMunicipio: "",
      tomadorMunicipio: "",
      tomadorUf: "",
      tomadorCep: "",
      tomadorCpf: detectedTipo === "PF" ? (clientData?.document ?? "") : "",
      tomadorNome: detectedTipo === "PF" ? (clientData?.name ?? "") : "",
    },
  });

  const tipoTomador = form.watch("tipoTomador");
  const environment = form.watch("environment");
  const municipioRequirements = resolveMunicipioRequirements(
    profile?.codigoMunicipio,
  );
  const requiresTomadorEndereco = municipioRequirements.requiresTomadorEndereco;
  const [step, setStep] = useState<"form" | "preview">("form");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [preflightErrors, setPreflightErrors] = useState<string[]>([]);
  const [municipioDisplay, setMunicipioDisplay] = useState("");

  const [tomadorCnpjLookupStatus, setTomadorCnpjLookupStatus] = useState<
    "idle" | "loading" | "found" | "not-found" | "rate-limited" | "error"
  >("idle");
  const lastFetchedTomadorCnpjRef = useRef<string>("");
  const tomadorCnpjDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const tomadorCnpjValue = form.watch("tomadorCnpj");

  useEffect(() => {
    if (tipoTomador !== "PJ") return;

    const digits = (tomadorCnpjValue ?? "").replace(/\D/g, "");
    if (digits.length !== 14 || digits === lastFetchedTomadorCnpjRef.current)
      return;

    if (tomadorCnpjDebounceRef.current)
      clearTimeout(tomadorCnpjDebounceRef.current);

    tomadorCnpjDebounceRef.current = setTimeout(async () => {
      setTomadorCnpjLookupStatus("loading");
      try {
        const response = await fetch(`/api/cnpj-ws/${digits}`);
        if (response.status === 404) {
          setTomadorCnpjLookupStatus("not-found");
          return;
        }
        if (response.status === 429) {
          setTomadorCnpjLookupStatus("rate-limited");
          return;
        }
        if (!response.ok) {
          setTomadorCnpjLookupStatus("error");
          return;
        }

        const responseData: CnpjWsResponse = await response.json();
        lastFetchedTomadorCnpjRef.current = digits;

        const estabelecimento = responseData.estabelecimento;
        const ibgeId = estabelecimento.cidade?.ibge_id;

        form.setValue("tomadorRazaoSocial", responseData.razao_social ?? "", {
          shouldValidate: true,
        });
        if (estabelecimento.logradouro)
          form.setValue("tomadorLogradouro", estabelecimento.logradouro, {
            shouldValidate: true,
          });
        if (estabelecimento.numero)
          form.setValue("tomadorNumero", estabelecimento.numero, {
            shouldValidate: true,
          });
        if (estabelecimento.complemento)
          form.setValue("tomadorComplemento", estabelecimento.complemento, {
            shouldValidate: true,
          });
        if (estabelecimento.bairro)
          form.setValue("tomadorBairro", estabelecimento.bairro, {
            shouldValidate: true,
          });
        if (estabelecimento.cep)
          form.setValue(
            "tomadorCep",
            estabelecimento.cep.replace(/\D/g, ""),
            { shouldValidate: true },
          );
        if (estabelecimento.estado?.sigla)
          form.setValue("tomadorUf", estabelecimento.estado.sigla, {
            shouldValidate: true,
          });
        if (ibgeId) {
          form.setValue(
            "tomadorCodigoMunicipio",
            String(ibgeId).padStart(7, "0"),
            { shouldValidate: true },
          );
          if (estabelecimento.cidade?.nome) {
            form.setValue("tomadorMunicipio", estabelecimento.cidade.nome);
            setMunicipioDisplay(
              `${estabelecimento.cidade.nome} — ${estabelecimento.estado?.sigla ?? ""}`,
            );
          }
        }

        setTomadorCnpjLookupStatus("found");
      } catch {
        setTomadorCnpjLookupStatus("error");
      }
    }, 700);

    return () => {
      if (tomadorCnpjDebounceRef.current)
        clearTimeout(tomadorCnpjDebounceRef.current);
    };
  }, [tomadorCnpjValue, tipoTomador, form]);

  useEffect(() => {
    if (!profile) return;
    // Ambiente é da empresa na NFE.io (Development/Production) — a emissão
    // usa o ambiente cadastrado no perfil, sem escolha por nota (link acima
    // manda pro perfil fiscal caso precise mudar).
    form.setValue("environment", profile.environment);
    form.setValue(
      "cityServiceCode",
      form.getValues("cityServiceCode") || (profile.defaultCityServiceCode ?? ""),
    );
    // Autopreenche o toggle de consumidor final com o padrão cadastrado no perfil
    // (o emitente ainda pode sobrescrever por nota na seção avançada).
    form.setValue("consumidorFinal", profile.defaultConsumidorFinal ?? false);
    // Autopreenche retenções/descontos e ISS retido com os padrões salvos no perfil.
    form.setValue("issRetido", profile.defaultIssRetido ?? false);
    form.setValue("irPercent", profile.defaultIrPercent ?? "0");
    form.setValue("pisPercent", profile.defaultPisPercent ?? "0");
    form.setValue("cofinsPercent", profile.defaultCofinsPercent ?? "0");
    form.setValue("csllPercent", profile.defaultCsllPercent ?? "0");
    form.setValue("inssPercent", profile.defaultInssPercent ?? "0");
    form.setValue(
      "outrasRetencoesPercent",
      profile.defaultOutrasRetencoesPercent ?? "0",
    );
    form.setValue("deducoesPercent", profile.defaultDeducoesPercent ?? "0");
    form.setValue(
      "descontoIncondicionadoPercent",
      profile.defaultDescontoIncondicionadoPercent ?? "0",
    );
    form.setValue(
      "descontoCondicionadoPercent",
      profile.defaultDescontoCondicionadoPercent ?? "0",
    );
    form.setValue(
      "informacoesAdicionais",
      profile.defaultInformacoesAdicionais ?? "",
    );
    const requirements = resolveMunicipioRequirements(profile.codigoMunicipio);
    form.setValue("requiresTomadorEndereco", requirements.requiresTomadorEndereco);

    const errors: string[] = [];
    if (!profile.nfeIoCompanyId)
      errors.push("Empresa não sincronizada na NFE.io — salve o perfil fiscal.");
    if (!profile.defaultCityServiceCode)
      errors.push(
        "Código de serviço municipal (NFE.io) não configurado no perfil fiscal.",
      );
    if (requirements.requiresInscricaoMunicipalPrestador && !profile.inscricaoMunicipal)
      errors.push("Inscrição municipal não configurada.");
    if (requirements.requiresCodigoCnae) {
      const cnaeDigits = requirements.requiresCodigoCnae.digits;
      if (!profile.defaultCodigoCnae)
        errors.push(
          `Seu município exige o código CNAE do serviço (${cnaeDigits} dígitos) — configure no perfil fiscal.`,
        );
      else if (profile.defaultCodigoCnae.length !== cnaeDigits)
        errors.push(
          `Seu município exige CNAE com ${cnaeDigits} dígitos — atualize o perfil fiscal.`,
        );
    }
    if (Number(profile.defaultAliquotaIss) <= 0)
      errors.push("Alíquota ISS inválida.");
    if (Number(serviceValue) <= 0)
      errors.push("Valor do serviço deve ser maior que zero.");
    setPreflightErrors(errors);
  }, [profile, serviceValue, form]);

  const handleReview = async () => {
    const isValid = await form.trigger();
    if (isValid) setStep("preview");
  };

  const onSubmit = async (values: IssueInvoiceFormValues) => {
    try {
      const overrides = {
        tipoTomador: values.tipoTomador,
        environment: values.environment,
        dataCompetencia: values.dataCompetencia,
        discriminacao: values.discriminacao || undefined,
        naturezaOperacao: values.naturezaOperacao,
        regimeEspecialTributacao:
          values.regimeEspecialTributacao &&
          values.regimeEspecialTributacao !== REGIME_PROFILE_DEFAULT
            ? Number(values.regimeEspecialTributacao)
            : undefined,
        ibsCbsSituacaoTributaria:
          values.ibsCbsSituacaoTributaria?.trim() || undefined,
        ibsCbsClassificacaoTributaria:
          values.ibsCbsClassificacaoTributaria?.trim() || undefined,
        consumidorFinal: values.consumidorFinal,
        cityServiceCode: values.cityServiceCode?.trim() || undefined,
        taxationType: values.taxationType || undefined,
        issRetido: values.issRetido,
        irPercent: toPercentNumber(values.irPercent),
        pisPercent: toPercentNumber(values.pisPercent),
        cofinsPercent: toPercentNumber(values.cofinsPercent),
        csllPercent: toPercentNumber(values.csllPercent),
        inssPercent: toPercentNumber(values.inssPercent),
        outrasRetencoesPercent: toPercentNumber(values.outrasRetencoesPercent),
        deducoesPercent: toPercentNumber(values.deducoesPercent),
        descontoIncondicionadoPercent: toPercentNumber(
          values.descontoIncondicionadoPercent,
        ),
        descontoCondicionadoPercent: toPercentNumber(
          values.descontoCondicionadoPercent,
        ),
        informacoesAdicionais: values.informacoesAdicionais?.trim() || undefined,
        tomadorInscricaoMunicipal:
          values.tomadorInscricaoMunicipal?.trim() || undefined,
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
        tomadorMunicipio: values.tomadorMunicipio,
        tomadorUf: values.tomadorUf,
        tomadorCep: values.tomadorCep,
      };

      const result =
        target.kind === "contract"
          ? await issueFromContract.mutateAsync({
              contractId: target.contractId,
              ...overrides,
            })
          : await issueFromPaymentEntry.mutateAsync({
              paymentEntryId: target.paymentEntryId,
              ...overrides,
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

  const taxationTypeLabel =
    TAXATION_TYPE_OPTIONS.find(
      (opt) => opt.value === form.watch("taxationType"),
    )?.label ?? "—";

  const naturezaOperacaoLabel =
    NATUREZA_OPERACAO_OPTIONS.find(
      (opt) => opt.value === form.watch("naturezaOperacao"),
    )?.label ?? "—";

  const regimeEspecialValue = form.watch("regimeEspecialTributacao");
  const regimeEspecialLabel =
    !regimeEspecialValue || regimeEspecialValue === REGIME_PROFILE_DEFAULT
      ? "Padrão do perfil"
      : (REGIME_ESPECIAL_OPTIONS.find(
          (opt) => opt.value === regimeEspecialValue,
        )?.label ?? regimeEspecialValue);

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
            {target.kind === "contract"
              ? `Emitir NFS-e — Contrato #${String(target.contractNumber).padStart(4, "0")}`
              : `Emitir NFS-e — ${target.label}`}
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
            {/* Ambiente de emissão — travado no ambiente cadastrado da empresa na NFE.io */}
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <p className="text-sm font-medium">
                {environment === "PRODUCAO"
                  ? "Produção (fiscal)"
                  : "Homologação"}
              </p>
              <p className="text-xs text-muted-foreground">
                Definido pelo ambiente cadastrado da empresa na NFE.io.{" "}
                <Link
                  href="/settings/fiscal"
                  className="text-blue-600 hover:underline"
                >
                  Alterar no perfil fiscal
                </Link>
                .
              </p>
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
                  <div className="relative">
                    <Input
                      {...form.register("tomadorCnpj")}
                      onChange={(e) => {
                        const masked = maskCnpj(e.target.value);
                        form.setValue("tomadorCnpj", masked, {
                          shouldValidate: form.formState.isSubmitted,
                        });
                      }}
                      placeholder="XX.XXX.XXX/XXXX-XX"
                      className="pr-8"
                    />
                    {tomadorCnpjLookupStatus === "loading" && (
                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                    )}
                    {tomadorCnpjLookupStatus === "found" && (
                      <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-emerald-600" />
                    )}
                  </div>
                  <FieldError message={formErrors.tomadorCnpj?.message} />
                  {tomadorCnpjLookupStatus === "not-found" && (
                    <p className="text-xs text-amber-600">
                      CNPJ não encontrado na base da Receita Federal —
                      preencha o endereço manualmente.
                    </p>
                  )}
                  {tomadorCnpjLookupStatus === "rate-limited" && (
                    <p className="text-xs text-amber-600">
                      Limite de consultas atingido. Aguarde 1 minuto ou
                      preencha o endereço manualmente.
                    </p>
                  )}
                  {tomadorCnpjLookupStatus === "error" && (
                    <p className="text-xs text-muted-foreground">
                      Não foi possível consultar o CNPJ automaticamente —
                      preencha o endereço manualmente.
                    </p>
                  )}
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
                <TomadorEnderecoFields
                  form={form}
                  municipioDisplay={municipioDisplay}
                  onMunicipioDisplayChange={setMunicipioDisplay}
                  required={requiresTomadorEndereco}
                />
                {!requiresTomadorEndereco && (
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    Seu município não exige o endereço do tomador, mas você
                    pode preenchê-lo.
                  </p>
                )}
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
                <TomadorEnderecoFields
                  form={form}
                  municipioDisplay={municipioDisplay}
                  onMunicipioDisplayChange={setMunicipioDisplay}
                  required={requiresTomadorEndereco}
                />
                {!requiresTomadorEndereco && (
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    Seu município não exige o endereço do tomador, mas você
                    pode preenchê-lo.
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Serviço */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Competência <span className="text-destructive">*</span>
                </Label>
                <Input {...form.register("dataCompetencia")} type="date" />
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
                    <Label>Código de Serviço Municipal</Label>
                    <Input
                      {...form.register("cityServiceCode")}
                      placeholder={
                        profile?.defaultCityServiceCode || "Padrão do perfil"
                      }
                    />
                    <FieldError message={formErrors.cityServiceCode?.message} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de Tributação</Label>
                    <Controller
                      control={form.control}
                      name="taxationType"
                      render={({ field }) => (
                        <Select
                          value={field.value ?? "WithinCity"}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {TAXATION_TYPE_OPTIONS.map((opt) => (
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
                  Dados fiscais da nota
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Natureza da Operação</Label>
                    <Controller
                      control={form.control}
                      name="naturezaOperacao"
                      render={({ field }) => (
                        <Select
                          value={field.value ?? "1"}
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
                          value={field.value ?? REGIME_PROFILE_DEFAULT}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={REGIME_PROFILE_DEFAULT}>
                              Padrão do perfil
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
                  Reforma tributária (IBS/CBS)
                </p>
                <p className="text-xs text-muted-foreground -mt-2">
                  Aplicável à NFS-e nacional. Deixe em branco para usar o padrão
                  do perfil fiscal.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Situação Tributária (CST)</Label>
                    <Input
                      {...form.register("ibsCbsSituacaoTributaria")}
                      placeholder={
                        profile?.ibsCbsSituacaoTributaria ?? "Ex.: 000"
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Classificação Tributária</Label>
                    <Input
                      {...form.register("ibsCbsClassificacaoTributaria")}
                      placeholder={
                        profile?.ibsCbsClassificacaoTributaria ?? "Ex.: 000001"
                      }
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between rounded-lg border px-4 py-2.5">
                    <div className="space-y-0.5">
                      <Label>Consumidor final</Label>
                      <p className="text-xs text-muted-foreground">
                        Marque quando o tomador é o consumidor final do serviço.
                      </p>
                    </div>
                    <Controller
                      control={form.control}
                      name="consumidorFinal"
                      render={({ field }) => (
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Retenções, deduções e descontos
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    % sobre o valor do serviço
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-lg border px-4 py-2.5">
                  <div className="space-y-0.5">
                    <Label>ISS retido na fonte</Label>
                    <p className="text-xs text-muted-foreground">
                      Retém o ISS na nota (valor calculado pela alíquota).
                    </p>
                  </div>
                  <Controller
                    control={form.control}
                    name="issRetido"
                    render={({ field }) => (
                      <Switch
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(
                    [
                      { name: "irPercent", label: "IR (%)" },
                      { name: "pisPercent", label: "PIS (%)" },
                      { name: "cofinsPercent", label: "COFINS (%)" },
                      { name: "csllPercent", label: "CSLL (%)" },
                      { name: "inssPercent", label: "INSS (%)" },
                      { name: "outrasRetencoesPercent", label: "Outras ret. (%)" },
                      { name: "deducoesPercent", label: "Deduções (%)" },
                      {
                        name: "descontoIncondicionadoPercent",
                        label: "Desc. incond. (%)",
                      },
                      {
                        name: "descontoCondicionadoPercent",
                        label: "Desc. cond. (%)",
                      },
                    ] as const
                  ).map((percentField) => (
                    <div key={percentField.name} className="space-y-1.5">
                      <Label className="text-xs">{percentField.label}</Label>
                      <Input
                        {...form.register(percentField.name)}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label>Informações adicionais</Label>
                  <Textarea
                    {...form.register("informacoesAdicionais")}
                    placeholder={
                      profile?.defaultInformacoesAdicionais ??
                      "Texto livre impresso na nota (opcional)..."
                    }
                    rows={2}
                  />
                </div>

                <Separator />

                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Contato do tomador
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Inscrição Municipal do tomador</Label>
                    <Input
                      {...form.register("tomadorInscricaoMunicipal")}
                      placeholder="IM do tomador (opcional)"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input
                      {...form.register("tomadorEmail")}
                      type="email"
                      placeholder="tomador@exemplo.com"
                    />
                  </div>
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
                )}
              </PreviewCard>
            </div>

            {/* Serviço */}
            <PreviewCard title="Serviço">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <div>
                  <PreviewRow
                    label="Valor"
                    value={fmtCurrency(serviceValue)}
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
                    label="Código de serviço municipal"
                    value={values.cityServiceCode || profile?.defaultCityServiceCode}
                  />
                </div>
                <div>
                  <PreviewRow
                    label="Tipo de Tributação"
                    value={taxationTypeLabel}
                  />
                  <PreviewRow
                    label="Natureza da Operação"
                    value={naturezaOperacaoLabel}
                  />
                  <PreviewRow
                    label="Regime Especial"
                    value={regimeEspecialLabel}
                  />
                  {values.ibsCbsSituacaoTributaria && (
                    <PreviewRow
                      label="CST (IBS/CBS)"
                      value={values.ibsCbsSituacaoTributaria}
                    />
                  )}
                  {values.ibsCbsClassificacaoTributaria && (
                    <PreviewRow
                      label="Classif. Trib."
                      value={values.ibsCbsClassificacaoTributaria}
                    />
                  )}
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
