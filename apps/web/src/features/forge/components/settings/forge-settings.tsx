"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForgeSettings,
  useUpdateForgeSettings,
} from "../../hooks/use-forge";
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
import { toast } from "sonner";
import {
  Percent,
  Palette,
  ImageIcon,
  CreditCard,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Upload,
  Link2,
  X,
  Shield,
  Bell,
} from "lucide-react";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";

// ─── Gateway definitions ────────────────────────────────────────────────────

interface GatewayDef {
  id: string;
  label: string;
  logo: string;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    secret?: boolean;
    hint?: string;
  }[];
  docUrl?: string;
}

const GATEWAYS: GatewayDef[] = [
  {
    id: "ASAAS",
    label: "Asaas",
    logo: "🏦",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "$aas_...",
        secret: true,
        hint: "Encontre em Configurações → Integrações → API dentro do Asaas",
      },
      { key: "env", label: "Ambiente", placeholder: "sandbox ou production" },
    ],
    docUrl: "https://docs.asaas.com",
  },
  {
    id: "STRIPE",
    label: "Stripe",
    logo: "💳",
    fields: [
      {
        key: "secretKey",
        label: "Secret Key",
        placeholder: "sk_live_...",
        secret: true,
        hint: "Painel Stripe → Developers → API Keys",
      },
      {
        key: "publicKey",
        label: "Publishable Key",
        placeholder: "pk_live_...",
      },
    ],
    docUrl: "https://stripe.com/docs",
  },
  {
    id: "MERCADOPAGO",
    label: "Mercado Pago",
    logo: "🛒",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "APP_USR-...",
        secret: true,
        hint: "Painel MP → Seu negócio → Configurações → Credenciais",
      },
    ],
    docUrl: "https://www.mercadopago.com.br/developers",
  },
  {
    id: "PAGBANK",
    label: "PagBank",
    logo: "🏧",
    fields: [
      {
        key: "token",
        label: "Token de Integração",
        placeholder: "...",
        secret: true,
      },
      {
        key: "email",
        label: "Email da conta PagBank",
        placeholder: "email@empresa.com",
      },
    ],
  },
  {
    id: "PIX",
    label: "PIX",
    logo: "🔑",
    fields: [
      {
        key: "pixKey",
        label: "Chave PIX",
        placeholder: "CPF, CNPJ, email ou chave aleatória",
      },
      {
        key: "pixName",
        label: "Nome do recebedor",
        placeholder: "Nome que aparece no PIX",
      },
    ],
  },
  {
    id: "PAGSEGURO",
    label: "PagSeguro",
    logo: "🔒",
    fields: [
      { key: "token", label: "Token", placeholder: "...", secret: true },
    ],
  },
];

// ─── S3 image field ──────────────────────────────────────────────────────────

function S3ImageField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (k: string) => void;
  hint?: string;
}) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const constructedUrl = useConstructUrl(value || "");
  // If value looks like a full URL, show it directly; otherwise build from key
  const previewUrl = value?.startsWith("http") ? value : constructedUrl;

  return (
    <div className="space-y-2">
      {/* Label + mode toggle */}
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center rounded-md border overflow-hidden text-[11px]">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 transition-colors",
              mode === "upload"
                ? "bg-[#7C3AED] text-white"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Upload className="size-3" /> Upload
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 transition-colors",
              mode === "url"
                ? "bg-[#7C3AED] text-white"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Link2 className="size-3" /> URL
          </button>
        </div>
      </div>

      {mode === "upload" ? (
        <Uploader
          value={value || undefined}
          fileTypeAccepted="image"
          onConfirm={onChange}
        />
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://... ou chave S3 (ex: uuid.png)"
              className="text-xs pr-8"
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {/* Preview */}
          {value && previewUrl && (
            <div className="relative h-20 rounded-lg border overflow-hidden bg-muted/30 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={label}
                className="max-h-full max-w-full object-contain p-2"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </div>
      )}

      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Gateway card ────────────────────────────────────────────────────────────

function GatewayCard({
  gateway,
  config,
  onChange,
}: {
  gateway: GatewayDef;
  config: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const isConfigured = gateway.fields.some(
    (f) => config[f.key] && config[f.key].trim() !== "",
  );

  return (
    <div
      className={cn(
        "border rounded-xl overflow-hidden transition-all",
        isConfigured ? "border-[#7C3AED]/40 bg-[#7C3AED]/3" : "border-border",
      )}
    >
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-xl">{gateway.logo}</span>
        <span className="font-semibold text-sm flex-1">{gateway.label}</span>
        {isConfigured && (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] gap-1 mr-1">
            <CheckCircle2 className="size-2.5" /> Configurado
          </Badge>
        )}
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t bg-card">
          {gateway.docUrl && (
            <a
              href={gateway.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-[#7C3AED] hover:underline mt-3"
            >
              📖 Ver documentação {gateway.label} →
            </a>
          )}
          {gateway.fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs">{f.label}</Label>
              <div className="relative">
                <Input
                  type={f.secret && !showSecrets[f.key] ? "password" : "text"}
                  value={config[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="text-xs pr-9"
                />
                {f.secret && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setShowSecrets((p) => ({ ...p, [f.key]: !p[f.key] }))
                    }
                  >
                    {showSecrets[f.key] ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                )}
              </div>
              {f.hint && (
                <p className="text-[11px] text-muted-foreground">{f.hint}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Form schema ─────────────────────────────────────────────────────────────

const schema = z.object({
  commissionPercentage: z.string().default("0"),
  letterheadHeader: z.string().nullable().optional(),
  letterheadFooter: z.string().nullable().optional(),
  proposalBgColor: z.string().default("#ffffff"),
  typographyColor: z.string().default("#111111"),
  securityLevel: z.enum(["PUBLICO", "PRIVADO", "TWO_FA"]).default("PUBLICO"),
  reminderDaysBefore: z.coerce.number().default(3),
});

type FormData = z.infer<typeof schema>;

// ─── Main component ──────────────────────────────────────────────────────────

export function ForgeSettingsPanel() {
  const { data, isLoading } = useForgeSettings();
  const update = useUpdateForgeSettings();

  // S3-backed image keys (managed outside react-hook-form)
  const [logoKey, setLogoKey] = useState("");
  const [headerImageKey, setHeaderImageKey] = useState("");
  const [footerImageKey, setFooterImageKey] = useState("");

  // Payment gateway configs
  const [gatewayConfigs, setGatewayConfigs] = useState<
    Record<string, Record<string, string>>
  >({});

  const form = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      commissionPercentage: "0",
      proposalBgColor: "#ffffff",
      typographyColor: "#111111",
      securityLevel: "PUBLICO",
      reminderDaysBefore: 3,
    },
  });

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings;
      form.reset({
        commissionPercentage: s.commissionPercentage,
        letterheadHeader: s.letterheadHeader,
        letterheadFooter: s.letterheadFooter,
        proposalBgColor: s.proposalBgColor,
        typographyColor: s.typographyColor ?? "#111111",
        securityLevel: s.securityLevel as "PUBLICO" | "PRIVADO" | "TWO_FA",
        reminderDaysBefore: s.reminderDaysBefore,
      });
      setLogoKey(s.logoUrl ?? "");
      setHeaderImageKey(s.letterheadHeaderImage ?? "");
      setFooterImageKey(s.letterheadFooterImage ?? "");
      const configs = s.paymentGatewayConfigs as Record<
        string,
        Record<string, string>
      >;
      setGatewayConfigs(
        typeof configs === "object" && configs !== null ? configs : {},
      );
    }
  }, [data]);

  const handleGatewayChange = (
    gatewayId: string,
    field: string,
    value: string,
  ) => {
    setGatewayConfigs((prev) => ({
      ...prev,
      [gatewayId]: { ...(prev[gatewayId] ?? {}), [field]: value },
    }));
  };

  const onSubmit = async (formData: FormData) => {
    try {
      await update.mutateAsync({
        commissionPercentage: formData.commissionPercentage,
        letterheadHeader: formData.letterheadHeader ?? null,
        letterheadFooter: formData.letterheadFooter ?? null,
        letterheadHeaderImage: headerImageKey || null,
        letterheadFooterImage: footerImageKey || null,
        logoUrl: logoKey || null,
        proposalBgColor: formData.proposalBgColor,
        typographyColor: formData.typographyColor,
        securityLevel: formData.securityLevel,
        reminderDaysBefore: formData.reminderDaysBefore,
        paymentGatewayConfigs: gatewayConfigs,
      });
      toast.success("Configurações salvas");
    } catch {
      toast.error("Erro ao salvar configurações");
    }
  };

  if (isLoading)
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        Carregando...
      </div>
    );

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6 px-4 pb-4"
    >
      {/* Comissões */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="size-4 text-[#7C3AED]" /> Comissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Percentual de comissão (%)</Label>
            <Input
              {...form.register("commissionPercentage")}
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="max-w-xs"
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Calculado sobre o valor pago das propostas para exibir comissões
              no painel.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Timbrado */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="size-4 text-[#7C3AED]" /> Timbrado &
            Identidade Visual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <S3ImageField
            label="Logo da empresa"
            value={logoKey}
            onChange={setLogoKey}
            hint="Aparece no cabeçalho das propostas e contratos."
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <S3ImageField
              label="Imagem do cabeçalho"
              value={headerImageKey}
              onChange={setHeaderImageKey}
              hint="Imagem superior das propostas (banner, marca d'água)."
            />
            <S3ImageField
              label="Imagem do rodapé"
              value={footerImageKey}
              onChange={setFooterImageKey}
              hint="Imagem inferior das propostas."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Texto do cabeçalho (HTML opcional)</Label>
            <Textarea
              {...form.register("letterheadHeader")}
              rows={2}
              placeholder="<p>Empresa XYZ · CNPJ 00.000.000/0001-00</p>"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Texto do rodapé (HTML opcional)</Label>
            <Textarea
              {...form.register("letterheadFooter")}
              rows={2}
              placeholder="<p>contato@empresa.com · (11) 99999-9999</p>"
              className="font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Aparência */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="size-4 text-[#7C3AED]" /> Aparência da Proposta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Cor de fundo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  {...form.register("proposalBgColor")}
                  className="w-10 h-9 rounded border cursor-pointer p-0.5"
                />
                <Input
                  {...form.register("proposalBgColor")}
                  className="flex-1 font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Cor de fundo da proposta pública.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Cor da tipografia</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  {...form.register("typographyColor")}
                  className="w-10 h-9 rounded border cursor-pointer p-0.5"
                />
                <Input
                  {...form.register("typographyColor")}
                  className="flex-1 font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Cor do texto na proposta pública.
              </p>
            </div>
          </div>
          {/* Live preview swatch */}
          <div
            className="rounded-lg border p-4 text-sm font-medium transition-colors"
            style={{
              backgroundColor: form.watch("proposalBgColor") || "#ffffff",
              color: form.watch("typographyColor") || "#111111",
            }}
          >
            <p className="font-bold text-base">Preview: PROPOSTA Nº 0001</p>
            <p className="mt-1 opacity-80">
              Nome do cliente · Válida até 30/12/2026
            </p>
            <p className="font-black text-lg mt-2">Total: R$ 2.500,00</p>
          </div>
        </CardContent>
      </Card>

      {/* Gateways de Pagamento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="size-4 text-[#7C3AED]" /> Gateways de
            Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Configure as credenciais dos gateways para gerar links de pagamento
            diretamente nas propostas.
          </p>
          {GATEWAYS.map((gw) => (
            <GatewayCard
              key={gw.id}
              gateway={gw}
              config={gatewayConfigs[gw.id] ?? {}}
              onChange={(field, value) =>
                handleGatewayChange(gw.id, field, value)
              }
            />
          ))}
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="size-4 text-[#7C3AED]" /> Segurança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Quem pode visualizar propostas públicas</Label>
            <Select
              value={form.watch("securityLevel")}
              onValueChange={(v) =>
                form.setValue(
                  "securityLevel",
                  v as "PUBLICO" | "PRIVADO" | "TWO_FA",
                )
              }
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLICO">
                  Público — qualquer um com o link
                </SelectItem>
                <SelectItem value="PRIVADO">
                  Privado — apenas logados
                </SelectItem>
                <SelectItem value="TWO_FA">
                  2FA — confirmação por email
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lembretes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="size-4 text-[#7C3AED]" /> Lembretes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Dias antes para aviso de vencimento</Label>
            <Input
              {...form.register("reminderDaysBefore")}
              type="number"
              min="0"
              max="30"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Notifica o responsável quando proposta ou contrato estiver prestes
              a vencer.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={update.isPending}
        className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
      >
        {update.isPending ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </form>
  );
}
