"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  useFiscalProfile,
  useUpsertFiscalProfile,
  useDeleteFiscalProfile,
} from "../hooks/use-fiscal-profile";
import { useSyncFiscalCompanyStatus } from "../hooks/use-fiscal-company-status";
import { MunicipioCombobox } from "./municipio-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Upload,
  KeyRound,
  Loader2,
  Trash2,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CnpjWsResponse } from "@/http/cnpj-ws/client";
import { maskCnpj, maskCpf } from "../utils/document-masks";
import { resolveMunicipioRequirements } from "../lib/municipio-requirements";
import {
  LEGAL_NATURE_OPTIONS,
  resolveLegalNatureFromReceitaCode,
  resolveTaxRegimeFromSimples,
  resolveCnaeFromAtividadePrincipal,
} from "../lib/cnpj-hydration";

const TAX_REGIME_OPTIONS = [
  { value: "MicroempreendedorIndividual", label: "MEI" },
  { value: "SimplesNacional", label: "Simples Nacional" },
  { value: "LucroPresumido", label: "Lucro Presumido" },
  { value: "LucroReal", label: "Lucro Real" },
  { value: "Isento", label: "Isento" },
] as const;

// Dropdown de seleção única baseado em DropdownMenu (não em Radix Select): o
// label do gatilho é resolvido direto do array de opções pelo value, então
// exibe corretamente mesmo com valor setado programaticamente (o Radix Select
// só resolve o label quando os itens estão montados, o que falhava na hidratação).
function OptionDropdown({
  value,
  onChange,
  options,
  placeholder = "Selecione",
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between font-normal"
        >
          <span
            className={cn("truncate", !selected && "text-muted-foreground")}
          >
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="size-4 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
      >
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const schema = z
  .object({
    documentoTipo: z.enum(["cnpj", "cpf"]),
    cnpj: z.string().optional(),
    cpf: z.string().optional(),
    razaoSocial: z.string().min(1, "Razão social obrigatória"),
    nomeFantasia: z.string().optional(),
    email: z.string().email("E-mail inválido"),
    openingDate: z.string().min(1, "Data de abertura obrigatória"),
    legalNature: z.string().min(1, "Natureza jurídica obrigatória"),
    taxRegime: z.string().min(1, "Regime tributário obrigatório"),
    municipio: z.string(),
    inscricaoMunicipal: z.string().min(1, "Inscrição municipal obrigatória"),
    codigoMunicipio: z
      .string()
      .regex(/^\d{7}$/, "Código IBGE deve ter 7 dígitos"),
    optanteSimplesNacional: z.boolean(),
    simplesNacionalMei: z.boolean(),
    regimeEspecialTributacao: z.string().optional(),
    logradouro: z.string().min(1, "Logradouro obrigatório"),
    numero: z.string().min(1, "Número obrigatório"),
    complemento: z.string().optional(),
    bairro: z.string().min(1, "Bairro obrigatório"),
    cep: z.string().min(8, "CEP obrigatório"),
    uf: z.string().length(2, "UF deve ter 2 letras"),
    defaultItemListaServico: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .pipe(
        z
          .string()
          .regex(
            /^\d{6}$/,
            "Deve ter 6 dígitos numéricos (2 para item, 2 para subitem e 2 para desdobro nacional)",
          ),
      ),
    defaultCityServiceCode: z.string().optional(),
    defaultAliquotaIss: z
      .string()
      .min(1, "Alíquota ISS obrigatória")
      .refine((value) => {
        const aliquota = Number(value);
        return Number.isFinite(aliquota) && aliquota >= 2 && aliquota <= 5;
      }, "Alíquota ISS deve estar entre 2% e 5% (limite legal — LC 116/2003)"),
    defaultIssRetido: z.boolean(),
    defaultTributacaoIssqn: z.number().int().min(1).max(4),
    defaultDiscriminacao: z.string().optional(),
    defaultCodigoCnae: z
      .string()
      .regex(/^\d{7}$|^\d{9}$/, "CNAE deve ter 7 ou 9 dígitos numéricos")
      .optional()
      .or(z.literal("")),
    defaultCodigoTributarioMunicipio: z.string().optional(),
    ibsCbsSituacaoTributaria: z
      .string()
      .regex(/^\d{1,3}$/, "CST deve ter 1 a 3 dígitos")
      .optional()
      .or(z.literal("")),
    ibsCbsClassificacaoTributaria: z
      .string()
      .regex(/^\d{6}$/, "Classificação deve ter 6 dígitos")
      .optional()
      .or(z.literal("")),
    defaultConsumidorFinal: z.boolean(),
    // Padrões financeiros percentuais (0–100) — string de input, coeridos no servidor.
    defaultIrPercent: z.string().optional(),
    defaultPisPercent: z.string().optional(),
    defaultCofinsPercent: z.string().optional(),
    defaultCsllPercent: z.string().optional(),
    defaultInssPercent: z.string().optional(),
    defaultOutrasRetencoesPercent: z.string().optional(),
    defaultDeducoesPercent: z.string().optional(),
    defaultDescontoIncondicionadoPercent: z.string().optional(),
    defaultDescontoCondicionadoPercent: z.string().optional(),
    defaultInformacoesAdicionais: z.string().optional(),
    supportedByFocus: z.boolean(),
    nfseStandard: z.enum(["MUNICIPAL", "NACIONAL"]).optional(),
    senhaCertificado: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.documentoTipo === "cnpj") {
      const digits = data.cnpj?.replace(/\D/g, "") ?? "";
      if (digits.length !== 14) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CNPJ obrigatório (14 dígitos)",
          path: ["cnpj"],
        });
      }
    } else {
      const digits = data.cpf?.replace(/\D/g, "") ?? "";
      if (digits.length !== 11) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CPF obrigatório (11 dígitos)",
          path: ["cpf"],
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

export function FiscalProfileForm() {
  const { data, isLoading } = useFiscalProfile();
  const upsert = useUpsertFiscalProfile();
  const deleteMutation = useDeleteFiscalProfile();
  const syncStatus = useSyncFiscalCompanyStatus();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const profile = data?.profile;

  const [certFile, setCertFile] = useState<File | null>(null);
  const certFileInputRef = useRef<HTMLInputElement>(null);

  const [cnpjLookupStatus, setCnpjLookupStatus] = useState<
    "idle" | "loading" | "found" | "not-found" | "rate-limited" | "error"
  >("idle");
  const lastFetchedCnpjRef = useRef<string>("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      documentoTipo: "cnpj",
      cnpj: "",
      cpf: "",
      razaoSocial: "",
      nomeFantasia: "",
      email: "",
      openingDate: "",
      legalNature: "",
      taxRegime: "",
      municipio: "",
      inscricaoMunicipal: "",
      codigoMunicipio: "",
      optanteSimplesNacional: false,
      simplesNacionalMei: false,
      regimeEspecialTributacao: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cep: "",
      uf: "",
      defaultItemListaServico: "",
      defaultCityServiceCode: "",
      defaultAliquotaIss: "",
      defaultIssRetido: false,
      defaultTributacaoIssqn: 1,
      defaultDiscriminacao: "",
      defaultCodigoCnae: "",
      defaultCodigoTributarioMunicipio: "",
      ibsCbsSituacaoTributaria: "",
      ibsCbsClassificacaoTributaria: "",
      defaultConsumidorFinal: false,
      defaultIrPercent: "0",
      defaultPisPercent: "0",
      defaultCofinsPercent: "0",
      defaultCsllPercent: "0",
      defaultInssPercent: "0",
      defaultOutrasRetencoesPercent: "0",
      defaultDeducoesPercent: "0",
      defaultDescontoIncondicionadoPercent: "0",
      defaultDescontoCondicionadoPercent: "0",
      defaultInformacoesAdicionais: "",
      supportedByFocus: false,
      nfseStandard: "MUNICIPAL",
      senhaCertificado: "",
    },
  });

  const documentoTipo = form.watch("documentoTipo");
  const cnpjValue = form.watch("cnpj");

  useEffect(() => {
    if (documentoTipo !== "cnpj") return;

    const digits = cnpjValue?.replace(/\D/g, "") ?? "";
    if (digits.length !== 14 || digits === lastFetchedCnpjRef.current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      setCnpjLookupStatus("loading");
      try {
        const response = await fetch(`/api/cnpj-ws/${digits}`);
        if (response.status === 404) {
          setCnpjLookupStatus("not-found");
          return;
        }
        if (response.status === 429) {
          setCnpjLookupStatus("rate-limited");
          return;
        }
        if (!response.ok) {
          setCnpjLookupStatus("error");
          return;
        }

        const responseData: CnpjWsResponse = await response.json();
        lastFetchedCnpjRef.current = digits;

        const estabelecimento = responseData.estabelecimento;
        const ibgeId = estabelecimento.cidade?.ibge_id;

        form.setValue("razaoSocial", responseData.razao_social ?? "", {
          shouldDirty: true,
        });
        if (estabelecimento.logradouro)
          form.setValue("logradouro", estabelecimento.logradouro, {
            shouldDirty: true,
          });
        if (estabelecimento.numero)
          form.setValue("numero", estabelecimento.numero, {
            shouldDirty: true,
          });
        if (estabelecimento.complemento)
          form.setValue("complemento", estabelecimento.complemento, {
            shouldDirty: true,
          });
        if (estabelecimento.bairro)
          form.setValue("bairro", estabelecimento.bairro, {
            shouldDirty: true,
          });
        if (estabelecimento.cep)
          form.setValue("cep", estabelecimento.cep.replace(/\D/g, ""), {
            shouldDirty: true,
          });
        if (estabelecimento.estado?.sigla)
          form.setValue("uf", estabelecimento.estado.sigla, {
            shouldDirty: true,
          });
        if (estabelecimento.cidade?.nome)
          form.setValue("municipio", estabelecimento.cidade.nome, {
            shouldDirty: true,
          });
        if (ibgeId)
          form.setValue("codigoMunicipio", String(ibgeId).padStart(7, "0"), {
            shouldDirty: true,
          });
        if (
          responseData.simples?.simples !== undefined &&
          responseData.simples?.simples !== null
        ) {
          form.setValue(
            "optanteSimplesNacional",
            responseData.simples.simples === "Sim",
            { shouldDirty: true },
          );
        }

        const legalNature = resolveLegalNatureFromReceitaCode(
          responseData.natureza_juridica?.id,
        );
        if (legalNature)
          form.setValue("legalNature", legalNature, { shouldDirty: true });

        const taxRegime = resolveTaxRegimeFromSimples(responseData.simples);
        if (taxRegime) {
          form.setValue("taxRegime", taxRegime, { shouldDirty: true });
          form.setValue(
            "simplesNacionalMei",
            taxRegime === "MicroempreendedorIndividual",
            { shouldDirty: true },
          );
        }

        // Só hidrata o CNAE se ainda estiver vazio — não sobrescreve um valor
        // que o usuário já ajustou (ex.: complemento de 9 dígitos do município).
        const cnae = resolveCnaeFromAtividadePrincipal(
          estabelecimento.atividade_principal,
        );
        if (cnae && !form.getValues("defaultCodigoCnae"))
          form.setValue("defaultCodigoCnae", cnae, { shouldDirty: true });

        setCnpjLookupStatus("found");
      } catch {
        setCnpjLookupStatus("error");
      }
    }, 700);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [cnpjValue, documentoTipo, form]);

  useEffect(() => {
    if (!profile) return;
    const storedDigits = (profile.cnpj ?? "").replace(/\D/g, "");
    const detectedTipo: "cnpj" | "cpf" =
      storedDigits.length <= 11 ? "cpf" : "cnpj";
    lastFetchedCnpjRef.current = storedDigits;
    form.reset({
      documentoTipo: detectedTipo,
      cnpj: detectedTipo === "cnpj" ? maskCnpj(profile.cnpj ?? "") : "",
      cpf: detectedTipo === "cpf" ? maskCpf(profile.cnpj ?? "") : "",
      razaoSocial: profile.razaoSocial,
      nomeFantasia: profile.nomeFantasia ?? "",
      email: profile.email ?? "",
      openingDate: profile.openingDate
        ? new Date(profile.openingDate).toISOString().slice(0, 10)
        : "",
      legalNature: profile.legalNature ?? "",
      taxRegime: profile.taxRegime ?? "",
      municipio: profile.municipio ?? "",
      inscricaoMunicipal: profile.inscricaoMunicipal,
      codigoMunicipio: profile.codigoMunicipio,
      optanteSimplesNacional: profile.optanteSimplesNacional,
      simplesNacionalMei: profile.simplesNacionalMei ?? false,
      regimeEspecialTributacao: profile.regimeEspecialTributacao ?? "",
      logradouro: profile.logradouro,
      numero: profile.numero,
      complemento: profile.complemento ?? "",
      bairro: profile.bairro,
      cep: profile.cep,
      uf: profile.uf,
      defaultItemListaServico: profile.defaultItemListaServico,
      defaultCityServiceCode: profile.defaultCityServiceCode ?? "",
      defaultAliquotaIss: profile.defaultAliquotaIss,
      defaultIssRetido: profile.defaultIssRetido,
      defaultTributacaoIssqn: profile.defaultTributacaoIssqn ?? 1,
      defaultDiscriminacao: profile.defaultDiscriminacao ?? "",
      defaultCodigoCnae: profile.defaultCodigoCnae ?? "",
      defaultCodigoTributarioMunicipio:
        profile.defaultCodigoTributarioMunicipio ?? "",
      ibsCbsSituacaoTributaria: profile.ibsCbsSituacaoTributaria ?? "",
      ibsCbsClassificacaoTributaria:
        profile.ibsCbsClassificacaoTributaria ?? "",
      defaultConsumidorFinal: profile.defaultConsumidorFinal ?? false,
      defaultIrPercent: profile.defaultIrPercent ?? "0",
      defaultPisPercent: profile.defaultPisPercent ?? "0",
      defaultCofinsPercent: profile.defaultCofinsPercent ?? "0",
      defaultCsllPercent: profile.defaultCsllPercent ?? "0",
      defaultInssPercent: profile.defaultInssPercent ?? "0",
      defaultOutrasRetencoesPercent:
        profile.defaultOutrasRetencoesPercent ?? "0",
      defaultDeducoesPercent: profile.defaultDeducoesPercent ?? "0",
      defaultDescontoIncondicionadoPercent:
        profile.defaultDescontoIncondicionadoPercent ?? "0",
      defaultDescontoCondicionadoPercent:
        profile.defaultDescontoCondicionadoPercent ?? "0",
      defaultInformacoesAdicionais: profile.defaultInformacoesAdicionais ?? "",
      supportedByFocus: profile.supportedByFocus,
      nfseStandard: profile.nfseStandard,
      senhaCertificado: "",
    });
  }, [profile, form]);

  const onSubmit = async (values: FormValues) => {
    let arquivoCertificadoBase64: string | undefined;
    if (certFile) {
      const arrayBuffer = await certFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      arquivoCertificadoBase64 = btoa(
        bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), ""),
      );
    }

    upsert.mutate(
      {
        ...values,
        ibsCbsSituacaoTributaria: values.ibsCbsSituacaoTributaria || null,
        ibsCbsClassificacaoTributaria:
          values.ibsCbsClassificacaoTributaria || null,
        defaultCodigoCnae: values.defaultCodigoCnae || null,
        defaultCodigoTributarioMunicipio:
          values.defaultCodigoTributarioMunicipio || null,
        defaultInformacoesAdicionais:
          values.defaultInformacoesAdicionais?.trim() || null,
        arquivoCertificadoBase64,
      },
      {
        onSuccess: (result) => {
          if (certFile) {
            setCertFile(null);
            form.setValue("senhaCertificado", "");
            if (certFileInputRef.current) certFileInputRef.current.value = "";
          }
          if (result.companyRegistered) {
            toast.success(
              "Perfil fiscal salvo. Empresa sincronizada na NFE.io.",
            );
          } else {
            toast.warning(
              "Perfil fiscal salvo, mas a empresa não foi sincronizada na NFE.io. Revise os dados e salve novamente.",
            );
          }
        },
        onError: () => {
          toast.error("Erro ao salvar perfil fiscal");
        },
      },
    );
  };

  if (isLoading)
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="w-full space-y-6 px-4 sm:px-6"
    >
      {profile !== undefined && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {profile?.nfeIoCompanyId ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-3 shrink-0" />
              {profile.nfeIoFiscalStatus
                ? `NFE.io: ${profile.nfeIoFiscalStatus}`
                : "Sincronizada na NFE.io"}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-3 shrink-0" />
              Não sincronizada na NFE.io
            </span>
          )}

          {profile?.nfeIoCompanyId && (
            <button
              type="button"
              onClick={() => {
                syncStatus.mutate(
                  {},
                  {
                    onSuccess: () =>
                      toast.success("Status sincronizado com a NFE.io."),
                    onError: () =>
                      toast.error("Erro ao sincronizar status na NFE.io."),
                  },
                );
              }}
              disabled={syncStatus.isPending}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              title="Sincronizar status"
            >
              <RefreshCw
                className={`size-3.5 ${syncStatus.isPending ? "animate-spin" : ""}`}
              />
            </button>
          )}

          {profile && (
            <Dialog
              open={deleteDialogOpen}
              onOpenChange={(open) => {
                setDeleteDialogOpen(open);
                if (!open) setDeleteConfirmInput("");
              }}
            >
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Deletar perfil fiscal</DialogTitle>
                  <DialogDescription>
                    Isso irá remover o perfil fiscal e desvincular a empresa da
                    SEFAZ. Essa ação não pode ser desfeita.
                  </DialogDescription>
                </DialogHeader>

                {(() => {
                  const confirmWord =
                    profile.nomeFantasia?.trim() || "Confirmar";
                  return (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground gap-1">
                        Digite
                        <span className="font-semibold text-foreground">
                          {confirmWord}
                        </span>
                        para confirmar
                      </Label>
                      <Input
                        value={deleteConfirmInput}
                        onChange={(e) => setDeleteConfirmInput(e.target.value)}
                        placeholder={confirmWord}
                        autoComplete="off"
                      />
                    </div>
                  );
                })()}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={
                      deleteMutation.isPending ||
                      deleteConfirmInput.trim() !==
                        (profile.nomeFantasia?.trim() || "Confirmar")
                    }
                    onClick={() =>
                      deleteMutation.mutate(
                        {},
                        {
                          onSuccess: () => {
                            setDeleteDialogOpen(false);
                            setDeleteConfirmInput("");
                            toast.success("Perfil fiscal deletado.");
                          },
                          onError: () => {
                            toast.error("Erro ao deletar perfil fiscal.");
                          },
                        },
                      )
                    }
                  >
                    {deleteMutation.isPending ? "Deletando..." : "Deletar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}

      <div className="space-y-6">
      {/* Dados do Prestador */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-4 text-[#7C3AED] shrink-0" /> Prestador de
            Serviços
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Tipo de documento */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Tipo de documento</Label>
            <div className="flex gap-2">
              {(["cnpj", "cpf"] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => {
                    form.setValue("documentoTipo", tipo);
                    form.setValue("cnpj", "");
                    form.setValue("cpf", "");
                    setCnpjLookupStatus("idle");
                    lastFetchedCnpjRef.current = "";
                  }}
                  className={`px-4 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                    documentoTipo === tipo
                      ? "bg-[#7C3AED] text-white border-[#7C3AED]"
                      : "bg-background text-muted-foreground border-border hover:border-[#7C3AED]"
                  }`}
                >
                  {tipo.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* CNPJ ou CPF */}
          {documentoTipo === "cnpj" ? (
            <div className="space-y-1.5">
              <Label>
                CNPJ <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  {...form.register("cnpj")}
                  onChange={(e) => {
                    const masked = maskCnpj(e.target.value);
                    e.target.value = masked;
                    form.setValue("cnpj", masked, { shouldDirty: true });
                  }}
                  placeholder="XX.XXX.XXX/XXXX-XX"
                  maxLength={18}
                  className="pr-8"
                />
                {cnpjLookupStatus === "loading" && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                )}
                {cnpjLookupStatus === "found" && (
                  <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-emerald-600" />
                )}
              </div>
              {form.formState.errors.cnpj && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.cnpj.message}
                </p>
              )}
              {cnpjLookupStatus === "not-found" && (
                <p className="text-xs text-amber-600">
                  CNPJ não encontrado na base da Receita Federal.
                </p>
              )}
              {cnpjLookupStatus === "rate-limited" && (
                <p className="text-xs text-amber-600">
                  Limite de consultas atingido. Aguarde 1 minuto.
                </p>
              )}
              {cnpjLookupStatus === "error" && (
                <p className="text-xs text-muted-foreground">
                  Não foi possível consultar o CNPJ automaticamente.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>
                CPF <span className="text-destructive">*</span>
              </Label>
              <Input
                {...form.register("cpf")}
                onChange={(e) => {
                  const masked = maskCpf(e.target.value);
                  e.target.value = masked;
                  form.setValue("cpf", masked, { shouldDirty: true });
                }}
                placeholder="XXX.XXX.XXX-XX"
                maxLength={14}
              />
              {form.formState.errors.cpf && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.cpf.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              Razão Social <span className="text-destructive">*</span>
            </Label>
            <Input
              {...form.register("razaoSocial")}
              placeholder="Nome da empresa"
            />
            {form.formState.errors.razaoSocial && (
              <p className="text-xs text-destructive">
                {form.formState.errors.razaoSocial.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Nome Fantasia</Label>
            <Input
              {...form.register("nomeFantasia")}
              placeholder="Nome fantasia (opcional)"
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Inscrição Municipal <span className="text-destructive">*</span>
            </Label>
            <Input {...form.register("inscricaoMunicipal")} placeholder="IM" />
          </div>

          <div className="space-y-1.5">
            <Label>
              E-mail da empresa <span className="text-destructive">*</span>
            </Label>
            <Input
              {...form.register("email")}
              type="email"
              placeholder="contato@empresa.com.br"
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>
              Data de abertura <span className="text-destructive">*</span>
            </Label>
            <Input {...form.register("openingDate")} type="date" />
            {form.formState.errors.openingDate && (
              <p className="text-xs text-destructive">
                {form.formState.errors.openingDate.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>
              Natureza Jurídica <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={form.control}
              name="legalNature"
              render={({ field }) => (
                <OptionDropdown
                  value={field.value}
                  onChange={field.onChange}
                  options={LEGAL_NATURE_OPTIONS}
                />
              )}
            />
            {form.formState.errors.legalNature && (
              <p className="text-xs text-destructive">
                {form.formState.errors.legalNature.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>
              Regime Tributário <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={form.control}
              name="taxRegime"
              render={({ field }) => (
                <OptionDropdown
                  value={field.value}
                  onChange={field.onChange}
                  options={TAX_REGIME_OPTIONS}
                />
              )}
            />
            {form.formState.errors.taxRegime && (
              <p className="text-xs text-destructive">
                {form.formState.errors.taxRegime.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.watch("optanteSimplesNacional")}
              onCheckedChange={(v) =>
                form.setValue("optanteSimplesNacional", v)
              }
            />
            <Label>Optante Simples Nacional</Label>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.watch("simplesNacionalMei")}
              onCheckedChange={(v) => form.setValue("simplesNacionalMei", v)}
            />
            <Label>Microempreendedor Individual (MEI)</Label>
          </div>

          <div className="space-y-1.5">
            <Label>Regime Especial de Tributação (opcional)</Label>
            <Input
              {...form.register("regimeEspecialTributacao")}
              placeholder="Ex: 1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Endereço do Prestador</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>
              Logradouro <span className="text-destructive">*</span>
            </Label>
            <Input {...form.register("logradouro")} placeholder="Rua / Av." />
          </div>
          <div className="space-y-1.5">
            <Label>
              Número <span className="text-destructive">*</span>
            </Label>
            <Input {...form.register("numero")} placeholder="123" />
          </div>
          <div className="space-y-1.5">
            <Label>Complemento</Label>
            <Input {...form.register("complemento")} placeholder="Sala 1" />
          </div>
          <div className="space-y-1.5">
            <Label>
              Bairro <span className="text-destructive">*</span>
            </Label>
            <Input {...form.register("bairro")} placeholder="Centro" />
          </div>
          <div className="space-y-1.5">
            <Label>
              CEP <span className="text-destructive">*</span>
            </Label>
            <Input {...form.register("cep")} placeholder="00000-000" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>
              Município <span className="text-destructive">*</span>
            </Label>
            <MunicipioCombobox
              displayValue={
                form.watch("municipio") && form.watch("uf")
                  ? `${form.watch("municipio")} — ${form.watch("uf")}`
                  : (form.watch("municipio") ?? "")
              }
              onSelect={(municipio) => {
                form.setValue("municipio", municipio.nome, {
                  shouldValidate: true,
                });
                form.setValue("uf", municipio.uf, { shouldValidate: true });
                form.setValue("codigoMunicipio", municipio.codigo_ibge, {
                  shouldValidate: true,
                });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Digite o nome para buscar — estado e código IBGE preenchidos
              automaticamente.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>UF</Label>
            <Input
              {...form.register("uf")}
              placeholder="SP"
              maxLength={2}
              readOnly
              className="bg-muted/50 cursor-default"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Código IBGE</Label>
            <Input
              {...form.register("codigoMunicipio")}
              placeholder="3550308"
              readOnly
              className="bg-muted/50 cursor-default"
            />
            {form.formState.errors.codigoMunicipio && (
              <p className="text-xs text-destructive">
                {form.formState.errors.codigoMunicipio.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Defaults do Serviço */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Padrões do Serviço</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="sm:min-h-10 items-start">
              Item da Lista de Serviço (Código Nacional NFS-e){" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              {...form.register("defaultItemListaServico")}
              placeholder="Ex: 170601"
            />
            <p className="text-xs text-muted-foreground">
              6 dígitos numéricos: 2 para item, 2 para subitem (LC 116/2003) e 2
              para desdobro nacional.
            </p>
            {form.formState.errors.defaultItemListaServico && (
              <p className="text-xs text-destructive">
                {form.formState.errors.defaultItemListaServico.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="sm:min-h-10 items-start">
              Código de Serviço Municipal (NFE.io)
            </Label>
            <Input
              {...form.register("defaultCityServiceCode")}
              placeholder="Ex: 0101"
            />
            <p className="text-xs text-muted-foreground">
              Código do serviço no formato da prefeitura — diferente do item da
              lista LC 116 acima. Consulte o contador ou a tabela da prefeitura.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="sm:min-h-10 items-start">
              Alíquota ISS (%) <span className="text-destructive">*</span>
            </Label>
            <Input
              {...form.register("defaultAliquotaIss")}
              type="number"
              min="2"
              max="5"
              step="0.01"
              placeholder="5.00"
            />
            <p className="text-xs text-muted-foreground">
              Percentual entre 2% e 5% (limite legal — LC 116/2003). Ex: 5 para
              5%.
            </p>
            {form.formState.errors.defaultAliquotaIss && (
              <p className="text-xs text-destructive">
                {form.formState.errors.defaultAliquotaIss.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="sm:min-h-10 items-start">
              Tributação do ISSQN <span className="text-destructive">*</span>
            </Label>
            <Select
              value={String(form.watch("defaultTributacaoIssqn"))}
              onValueChange={(value) =>
                form.setValue("defaultTributacaoIssqn", Number(value))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 — Operação tributável</SelectItem>
                <SelectItem value="2">2 — Imunidade</SelectItem>
                <SelectItem value="3">3 — Exportação de serviços</SelectItem>
                <SelectItem value="4">4 — Não incidência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.watch("defaultIssRetido")}
              onCheckedChange={(v) => form.setValue("defaultIssRetido", v)}
            />
            <Label>ISS Retido na Fonte</Label>
          </div>
          {(() => {
            const municipioRequirements = resolveMunicipioRequirements(
              form.watch("codigoMunicipio"),
            );
            return (
              <div className="space-y-1.5">
                <Label className="sm:min-h-10 items-start">
                  Código CNAE do serviço{" "}
                  {municipioRequirements.requiresCodigoCnae && (
                    <span className="text-destructive">*</span>
                  )}
                </Label>
                <Input
                  {...form.register("defaultCodigoCnae")}
                  inputMode="numeric"
                  placeholder="Ex: 620910000"
                />
                <p className="text-xs text-muted-foreground">
                  {municipioRequirements.requiresCodigoCnae
                    ? `Seu município exige CNAE de ${municipioRequirements.requiresCodigoCnae.digits} dígitos na emissão.`
                    : "Opcional — alguns municípios exigem o CNAE na emissão."}
                </p>
                {form.formState.errors.defaultCodigoCnae && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.defaultCodigoCnae.message}
                  </p>
                )}
              </div>
            );
          })()}
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Discriminação padrão do serviço</Label>
            <Textarea
              {...form.register("defaultDiscriminacao")}
              placeholder="Descrição padrão para o campo de serviços da NFS-e"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Retenções e descontos padrão */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Retenções e descontos padrão
          </CardTitle>
          <p className="text-xs text-muted-foreground pt-1">
            Percentuais aplicados sobre o valor do serviço na emissão. Deixe 0
            quando não houver. Podem ser sobrescritos por nota.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {(
            [
              { name: "defaultIrPercent", label: "IR (%)" },
              { name: "defaultPisPercent", label: "PIS (%)" },
              { name: "defaultCofinsPercent", label: "COFINS (%)" },
              { name: "defaultCsllPercent", label: "CSLL (%)" },
              { name: "defaultInssPercent", label: "INSS (%)" },
              {
                name: "defaultOutrasRetencoesPercent",
                label: "Outras ret. (%)",
              },
              { name: "defaultDeducoesPercent", label: "Deduções (%)" },
              {
                name: "defaultDescontoIncondicionadoPercent",
                label: "Desc. incondicionado (%)",
              },
              {
                name: "defaultDescontoCondicionadoPercent",
                label: "Desc. condicionado (%)",
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
          <div className="col-span-2 sm:col-span-3 space-y-1.5">
            <Label>Informações adicionais padrão</Label>
            <Textarea
              {...form.register("defaultInformacoesAdicionais")}
              placeholder="Texto livre impresso na nota (ex.: dados bancários, observações)"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Certificado A1 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#7C3AED] shrink-0" />{" "}
            Certificado A1 Digital
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile?.nfeIoCertificateStatus === "Active" ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4 shrink-0" />
              Certificado ativo na NFE.io
              {profile.nfeIoCertificateExpiresOn &&
                ` — expira em ${new Date(
                  profile.nfeIoCertificateExpiresOn,
                ).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}`}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-4 shrink-0" />
              Nenhum certificado ativo na NFE.io. A emissão de notas requer o
              A1.
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Upload className="size-3.5" /> Arquivo .pfx ou .p12
              </Label>
              <input
                ref={certFileInputRef}
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:text-xs file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80 cursor-pointer"
              />
              {certFile && (
                <p className="text-xs text-muted-foreground">{certFile.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <KeyRound className="size-3.5" /> Senha do certificado
              </Label>
              <Input
                {...form.register("senhaCertificado")}
                type="password"
                placeholder="Senha do arquivo .pfx / .p12"
                autoComplete="off"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              O arquivo não é armazenado — é enviado diretamente à NFE.io junto
              com o cadastro da empresa.
            </p>
          </div>
        </CardContent>
      </Card>
      </div>

      <Button
        type="submit"
        disabled={upsert.isPending}
        className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
      >
        {upsert.isPending ? "Salvando..." : "Salvar Perfil Fiscal"}
      </Button>
    </form>
  );
}
