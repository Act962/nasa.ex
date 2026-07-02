"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  useFiscalProfile,
  useUpsertFiscalProfile,
  useDeleteFiscalProfile,
} from "../hooks/use-fiscal-profile";
import { MunicipioCombobox } from "./municipio-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
} from "lucide-react";
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

const schema = z
  .object({
    documentoTipo: z.enum(["cnpj", "cpf"]),
    cnpj: z.string().optional(),
    cpf: z.string().optional(),
    razaoSocial: z.string().min(1, "Razão social obrigatória"),
    nomeFantasia: z.string().optional(),
    municipio: z.string(),
    inscricaoMunicipal: z.string().min(1, "Inscrição municipal obrigatória"),
    codigoMunicipio: z
      .string()
      .regex(/^\d{7}$/, "Código IBGE deve ter 7 dígitos"),
    optanteSimplesNacional: z.boolean(),
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
    defaultAliquotaIss: z.string().min(1, "Alíquota ISS obrigatória"),
    defaultIssRetido: z.boolean(),
    defaultDiscriminacao: z.string().optional(),
    supportedByFocus: z.boolean(),
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
      municipio: "",
      inscricaoMunicipal: "",
      codigoMunicipio: "",
      optanteSimplesNacional: false,
      regimeEspecialTributacao: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cep: "",
      uf: "",
      defaultItemListaServico: "",
      defaultAliquotaIss: "",
      defaultIssRetido: false,
      defaultDiscriminacao: "",
      supportedByFocus: false,
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
      municipio: profile.municipio ?? "",
      inscricaoMunicipal: profile.inscricaoMunicipal,
      codigoMunicipio: profile.codigoMunicipio,
      optanteSimplesNacional: profile.optanteSimplesNacional,
      regimeEspecialTributacao: profile.regimeEspecialTributacao ?? "",
      logradouro: profile.logradouro,
      numero: profile.numero,
      complemento: profile.complemento ?? "",
      bairro: profile.bairro,
      cep: profile.cep,
      uf: profile.uf,
      defaultItemListaServico: profile.defaultItemListaServico,
      defaultAliquotaIss: profile.defaultAliquotaIss,
      defaultIssRetido: profile.defaultIssRetido,
      defaultDiscriminacao: profile.defaultDiscriminacao ?? "",
      supportedByFocus: profile.supportedByFocus,
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
      { ...values, arquivoCertificadoBase64 },
      {
        onSuccess: (result) => {
          if (certFile) {
            setCertFile(null);
            form.setValue("senhaCertificado", "");
            if (certFileInputRef.current) certFileInputRef.current.value = "";
          }
          if (result.focusEmpresaRegistered) {
            toast.success(
              "Perfil fiscal salvo. Empresa cadastrada na Focus NFe.",
            );
          } else {
            toast.warning(
              "Perfil fiscal salvo. Empresa não encontrada na Focus — cadastre o certificado A1 no painel da Focus.",
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-4">
      {profile !== undefined && (
        <div className="flex items-center justify-end gap-2">
          {profile?.focusEmpresaRegistered ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-3 shrink-0" />
              Sincronizada
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-3 shrink-0" />
              Dessincronizada
            </span>
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

      {/* Dados do Prestador */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-4 text-[#7C3AED]" /> Prestador de
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

          <div className="flex items-center gap-3">
            <Switch
              checked={form.watch("optanteSimplesNacional")}
              onCheckedChange={(v) =>
                form.setValue("optanteSimplesNacional", v)
              }
            />
            <Label>Optante Simples Nacional</Label>
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
                form.setValue(
                  "supportedByFocus",
                  municipio.habilita_nfse ?? false,
                );
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
            <Label>
              Item da Lista de Serviço (Código Nacional NFS-e){" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              {...form.register("defaultItemListaServico")}
              placeholder="Ex: 170601"
            />
            <p className="text-xs text-muted-foreground">
              6 dígitos numéricos: 2 para item, 2 para subitem (LC 116/2003) e
              2 para desdobro nacional.
            </p>
            {form.formState.errors.defaultItemListaServico && (
              <p className="text-xs text-destructive">
                {form.formState.errors.defaultItemListaServico.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>
              Alíquota ISS (%) <span className="text-destructive">*</span>
            </Label>
            <Input
              {...form.register("defaultAliquotaIss")}
              type="number"
              step="0.01"
              placeholder="5.00"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.watch("defaultIssRetido")}
              onCheckedChange={(v) => form.setValue("defaultIssRetido", v)}
            />
            <Label>ISS Retido na Fonte</Label>
          </div>
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

      {/* Certificado A1 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#7C3AED]" /> Certificado A1
            Digital
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile?.focusCertificadoUploadedAt ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4 shrink-0" />
              Certificado enviado em{" "}
              {new Date(profile.focusCertificadoUploadedAt).toLocaleDateString(
                "pt-BR",
                {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                },
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-4 shrink-0" />
              Nenhum certificado enviado. A emissão de notas requer o A1.
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
              O arquivo não é armazenado — é enviado diretamente à Focus NFe
              junto com o cadastro da empresa.
            </p>
          </div>
        </CardContent>
      </Card>

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
