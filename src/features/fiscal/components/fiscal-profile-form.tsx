"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  useFiscalProfile,
  useUpsertFiscalProfile,
} from "../hooks/use-fiscal-profile";
import { useUploadFiscalCertificate } from "../hooks/use-fiscal-certificate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, CheckCircle2, AlertTriangle, ShieldCheck, Upload, KeyRound } from "lucide-react";

const schema = z.object({
  cnpj: z.string().min(14, "CNPJ obrigatório"),
  razaoSocial: z.string().min(1, "Razão social obrigatória"),
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
  defaultItemListaServico: z.string().min(1, "Item da lista de serviço obrigatório"),
  defaultAliquotaIss: z.string().min(1, "Alíquota ISS obrigatória"),
  defaultIssRetido: z.boolean(),
  defaultDiscriminacao: z.string().optional(),
  environment: z.enum(["HOMOLOGACAO", "PRODUCAO"]),
  supportedByFocus: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function FiscalProfileForm() {
  const { data, isLoading } = useFiscalProfile();
  const upsert = useUpsertFiscalProfile();
  const uploadCertificate = useUploadFiscalCertificate();
  const profile = data?.profile;

  const [certFile, setCertFile] = useState<File | null>(null);
  const [certSenha, setCertSenha] = useState("");
  const certFileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cnpj: "",
      razaoSocial: "",
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
      environment: "HOMOLOGACAO",
      supportedByFocus: false,
    },
  });

  useEffect(() => {
    if (!profile) return;
    form.reset({
      cnpj: profile.cnpj,
      razaoSocial: profile.razaoSocial,
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
      environment: profile.environment as "HOMOLOGACAO" | "PRODUCAO",
      supportedByFocus: profile.supportedByFocus,
    });
  }, [profile, form]);

  const handleCertificateUpload = async () => {
    if (!certFile || !certSenha.trim()) return;
    try {
      await uploadCertificate.mutateAsync({ arquivo: certFile, senha: certSenha.trim() });
      toast.success("Certificado A1 enviado com sucesso.");
      setCertFile(null);
      setCertSenha("");
      if (certFileInputRef.current) certFileInputRef.current.value = "";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar certificado";
      toast.error(message);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await upsert.mutateAsync(values);
      if (result.focusEmpresaRegistered) {
        toast.success("Perfil fiscal salvo. Empresa cadastrada na Focus NFe.");
      } else {
        toast.warning(
          "Perfil fiscal salvo. Empresa não encontrada na Focus — cadastre o certificado A1 no painel da Focus.",
        );
      }
    } catch {
      toast.error("Erro ao salvar perfil fiscal");
    }
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {profile?.focusEmpresaRegistered && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0" />
          Empresa cadastrada na Focus NFe
        </div>
      )}
      {profile && !profile.focusEmpresaRegistered && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" />
          Empresa ainda não cadastrada na Focus NFe. Adicione o certificado A1
          no painel.
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
          <div className="space-y-1.5">
            <Label>CNPJ</Label>
            <Input {...form.register("cnpj")} placeholder="XX.XXX.XXX/XXXX-XX" />
            {form.formState.errors.cnpj && (
              <p className="text-xs text-destructive">
                {form.formState.errors.cnpj.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Razão Social</Label>
            <Input {...form.register("razaoSocial")} placeholder="Nome da empresa" />
          </div>
          <div className="space-y-1.5">
            <Label>Inscrição Municipal</Label>
            <Input {...form.register("inscricaoMunicipal")} placeholder="IM" />
          </div>
          <div className="space-y-1.5">
            <Label>Código IBGE do Município (7 dígitos)</Label>
            <Input {...form.register("codigoMunicipio")} placeholder="3550308" />
            {form.formState.errors.codigoMunicipio && (
              <p className="text-xs text-destructive">
                {form.formState.errors.codigoMunicipio.message}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.watch("optanteSimplesNacional")}
              onCheckedChange={(v) => form.setValue("optanteSimplesNacional", v)}
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
            <Label>Logradouro</Label>
            <Input {...form.register("logradouro")} placeholder="Rua / Av." />
          </div>
          <div className="space-y-1.5">
            <Label>Número</Label>
            <Input {...form.register("numero")} placeholder="123" />
          </div>
          <div className="space-y-1.5">
            <Label>Complemento</Label>
            <Input {...form.register("complemento")} placeholder="Sala 1" />
          </div>
          <div className="space-y-1.5">
            <Label>Bairro</Label>
            <Input {...form.register("bairro")} placeholder="Centro" />
          </div>
          <div className="space-y-1.5">
            <Label>CEP</Label>
            <Input {...form.register("cep")} placeholder="00000-000" />
          </div>
          <div className="space-y-1.5">
            <Label>UF</Label>
            <Input {...form.register("uf")} placeholder="SP" maxLength={2} />
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
            <Label>Item da Lista de Serviço (LC 116)</Label>
            <Input
              {...form.register("defaultItemListaServico")}
              placeholder="Ex: 17.09"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Alíquota ISS (%)</Label>
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

      {/* Infra */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configurações Focus NFe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Ambiente</Label>
            <Select
              value={form.watch("environment")}
              onValueChange={(v) =>
                form.setValue("environment", v as "HOMOLOGACAO" | "PRODUCAO")
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HOMOLOGACAO">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                      Homologação
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="PRODUCAO">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                      Produção
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.watch("supportedByFocus")}
              onCheckedChange={(v) => form.setValue("supportedByFocus", v)}
            />
            <div>
              <Label>Município suportado pela Focus NFe</Label>
              <p className="text-xs text-muted-foreground">
                Apenas municípios integrados na Focus NFe podem emitir notas.
              </p>
            </div>
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
                { day: "2-digit", month: "2-digit", year: "numeric" },
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
                <Upload className="size-3.5" /> Arquivo .pfx
              </Label>
              <input
                ref={certFileInputRef}
                type="file"
                accept=".pfx"
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
                type="password"
                value={certSenha}
                onChange={(e) => setCertSenha(e.target.value)}
                placeholder="Senha do arquivo .pfx"
                autoComplete="off"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              O arquivo não é armazenado — é enviado diretamente à Focus NFe e
              descartado.
            </p>

            <Button
              type="button"
              variant="outline"
              disabled={
                !certFile ||
                !certSenha.trim() ||
                uploadCertificate.isPending ||
                !profile
              }
              onClick={handleCertificateUpload}
              className="w-full gap-2"
            >
              <ShieldCheck className="size-4" />
              {uploadCertificate.isPending
                ? "Enviando..."
                : profile?.focusCertificadoUploadedAt
                  ? "Substituir certificado"
                  : "Enviar certificado"}
            </Button>
            {!profile && (
              <p className="text-xs text-muted-foreground text-center">
                Salve o perfil fiscal antes de enviar o certificado.
              </p>
            )}
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
