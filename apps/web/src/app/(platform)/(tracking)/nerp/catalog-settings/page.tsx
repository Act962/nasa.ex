"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { NerpShell } from "../../../../../features/nerp/components/nerp-shell";
import { NerpConnectionGuard } from "../../../../../features/nerp/components/connection-guard";
import { NerpSubdomainDialog } from "../../../../../features/nerp/components/nerp-subdomain-dialog";
import {
  useNerpCatalogSettings,
  useUpdateNerpCatalogSettings,
} from "../../../../../features/nerp/hooks/use-nerp-catalog-settings";

// Enums do nerp (`prisma/schema.prisma`). Mantemos labels em pt-BR só na UI.
const SORT_ORDERS = [
  { value: "ASC", label: "A → Z" },
  { value: "DESC", label: "Z → A" },
  { value: "NEWEST", label: "Mais novos primeiro" },
  { value: "OLDEST", label: "Mais antigos primeiro" },
] as const;

const PAYMENT_METHODS = [
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "PIX", label: "Pix" },
  { value: "DEBITO", label: "Cartão de débito" },
  { value: "CREDITO", label: "Cartão de crédito" },
  { value: "BOLETO", label: "Boleto" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "OUTROS", label: "Outros" },
] as const;

const DELIVERY_METHODS = [
  { value: "DELIVERY_HOME", label: "Entrega em domicílio" },
  { value: "PICKUP_STORE", label: "Retirada na loja" },
  { value: "ROOM_SERVICE", label: "Serviço de quarto" },
  { value: "DIGITAL_DELIVERY", label: "Entrega digital" },
] as const;

const FREIGHT_OPTIONS = [
  { value: "NO_SHIPPING", label: "Sem envio" },
  { value: "NEGOTIATE_WHATSAPP", label: "Negociar no WhatsApp" },
  { value: "NEGOTIATE_FREIGHT", label: "Negociar frete" },
  { value: "FREE_SHIPPING", label: "Frete grátis" },
] as const;

const FREIGHT_CHARGE_TYPES = [
  { value: "FIXED", label: "Valor fixo" },
  { value: "PER_KG", label: "Por kg" },
] as const;

// `bannerImages` no nerp é `string[]`. Na UI usamos textarea com 1 URL por
// linha — mais simples que array dinâmico e cobre o caso típico (poucas).
const formSchema = z.object({
  // Visibilidade
  isActive: z.boolean(),
  showPrices: z.boolean(),
  showStock: z.boolean(),
  showProductWithoutStock: z.boolean(),
  allowOrders: z.boolean(),
  sortOrder: z.enum(["ASC", "DESC", "NEWEST", "OLDEST"]),
  // Contato
  whatsappNumber: z.string().optional(),
  showWhatsapp: z.boolean(),
  contactEmail: z.string().optional(),
  // Endereço
  cep: z.string().optional(),
  address: z.string().optional(),
  district: z.string().optional(),
  number: z.string().optional(),
  cnpj: z.string().optional(),
  // Identidade visual
  logo: z.string().optional(),
  bannerImagesText: z.string().optional(),
  aboutText: z.string().optional(),
  theme: z.string().optional(),
  // SEO
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  // Pagamento
  paymentMethodSettings: z.array(
    z.enum(["DINHEIRO", "PIX", "DEBITO", "CREDITO", "BOLETO", "TRANSFERENCIA", "OUTROS"]),
  ),
  // Entrega
  deliveryMethods: z.array(
    z.enum(["DELIVERY_HOME", "PICKUP_STORE", "ROOM_SERVICE", "DIGITAL_DELIVERY"]),
  ),
  deliverySpecialInfo: z.string().optional(),
  // Frete
  freightOptions: z.enum(["NO_SHIPPING", "NEGOTIATE_WHATSAPP", "NEGOTIATE_FREIGHT", "FREE_SHIPPING"]),
  freightChargeType: z.enum(["FIXED", "PER_KG"]),
  freightFixedValue: z.coerce.number().nonnegative(),
  freightValuePerKg: z.coerce.number().nonnegative(),
  freeShippingEnabled: z.boolean(),
  freeShippingMinValue: z.coerce.number().nonnegative(),
  // Integrações
  id_meta: z.string().optional(),
  pixel_meta: z.string().optional(),
  walletId: z.string().optional(),
  // Redes sociais
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  twitter: z.string().optional(),
  youtube: z.string().optional(),
  kwai: z.string().optional(),
  tiktok: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

// `bannerImages` ↔ textarea: ignora linhas vazias, trima brancos.
function parseBannerImages(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function SwitchField({
  control,
  name,
  label,
  description,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  name: keyof FormValues;
  label: string;
  description?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between rounded border px-3 py-2 gap-3">
          <div className="space-y-0.5">
            <FormLabel className="m-0">{label}</FormLabel>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <FormControl>
            <Switch
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export default function NerpCatalogSettingsPage() {
  const query = useNerpCatalogSettings();
  const update = useUpdateNerpCatalogSettings();
  const settings = query.data?.catalogSettings;

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      isActive: true,
      showPrices: true,
      showStock: false,
      showProductWithoutStock: false,
      allowOrders: false,
      sortOrder: "ASC",
      whatsappNumber: "",
      showWhatsapp: true,
      contactEmail: "",
      cep: "",
      address: "",
      district: "",
      number: "",
      cnpj: "",
      logo: "",
      bannerImagesText: "",
      aboutText: "",
      theme: "#00bcd4",
      metaTitle: "",
      metaDescription: "",
      paymentMethodSettings: [],
      deliveryMethods: [],
      deliverySpecialInfo: "",
      freightOptions: "NO_SHIPPING",
      freightChargeType: "FIXED",
      freightFixedValue: 0,
      freightValuePerKg: 0,
      freeShippingEnabled: false,
      freeShippingMinValue: 0,
      id_meta: "",
      pixel_meta: "",
      walletId: "",
      instagram: "",
      facebook: "",
      twitter: "",
      youtube: "",
      kwai: "",
      tiktok: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        isActive: settings.isActive ?? true,
        showPrices: settings.showPrices ?? true,
        showStock: settings.showStock ?? false,
        showProductWithoutStock: settings.showProductWithoutStock ?? false,
        allowOrders: settings.allowOrders ?? false,
        sortOrder: settings.sortOrder ?? "ASC",
        whatsappNumber: settings.whatsappNumber ?? "",
        showWhatsapp: settings.showWhatsapp ?? true,
        contactEmail: settings.contactEmail ?? "",
        cep: settings.cep ?? "",
        address: settings.address ?? "",
        district: settings.district ?? "",
        number: settings.number ?? "",
        cnpj: settings.cnpj ?? "",
        logo: settings.logo ?? "",
        bannerImagesText: (settings.bannerImages ?? []).join("\n"),
        aboutText: settings.aboutText ?? "",
        theme: settings.theme ?? "#00bcd4",
        metaTitle: settings.metaTitle ?? "",
        metaDescription: settings.metaDescription ?? "",
        paymentMethodSettings: settings.paymentMethodSettings ?? [],
        deliveryMethods: settings.deliveryMethods ?? [],
        deliverySpecialInfo: settings.deliverySpecialInfo ?? "",
        freightOptions: settings.freightOptions ?? "NO_SHIPPING",
        freightChargeType: settings.freightChargeType ?? "FIXED",
        freightFixedValue: settings.freightFixedValue ?? 0,
        freightValuePerKg: settings.freightValuePerKg ?? 0,
        freeShippingEnabled: settings.freeShippingEnabled ?? false,
        freeShippingMinValue: settings.freeShippingMinValue ?? 0,
        id_meta: settings.id_meta ?? "",
        pixel_meta: settings.pixel_meta ?? "",
        walletId: settings.walletId ?? "",
        instagram: settings.instagram ?? "",
        facebook: settings.facebook ?? "",
        twitter: settings.twitter ?? "",
        youtube: settings.youtube ?? "",
        kwai: settings.kwai ?? "",
        tiktok: settings.tiktok ?? "",
      });
    }
  }, [settings, form]);

  const onSubmit = (v: FormValues) => {
    if (!settings?.id) return;
    const { bannerImagesText, ...rest } = v;
    update.mutate(
      {
        id: settings.id,
        ...rest,
        bannerImages: parseBannerImages(bannerImagesText),
      },
      {
        onSuccess: () => toast.success("Configurações atualizadas"),
        onError: (err: { message?: string }) =>
          toast.error(err?.message ?? "Falhou"),
      },
    );
  };

  return (
    <NerpShell
      title="Configurações do catálogo"
      description="Personalização completa do catálogo online: visibilidade, frete, pagamento, SEO e redes sociais."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
        </Button>
      }
    >
      <NerpConnectionGuard>
        {query.isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin inline mr-2" /> Carregando…
            </CardContent>
          </Card>
        ) : !settings?.id ? (
          <Card>
            <CardContent className="py-6">
              <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                Configurações do catálogo ainda não criadas no nerp.
              </div>
            </CardContent>
          </Card>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Tabs defaultValue="general" className="w-full">
                {/* Abas: scroll horizontal no mobile (touch-friendly), grid em
                    tablet, flex-wrap no desktop. Cada gatilho recebe `text-xs`
                    em mobile pra caber sem clipar. */}
                <TabsList className="flex w-full overflow-x-auto sm:grid sm:grid-cols-4 lg:flex lg:flex-wrap h-auto justify-start sm:w-full lg:w-auto p-1 gap-1">
                  <TabsTrigger value="general" className="text-xs sm:text-sm flex-shrink-0">
                    Geral
                  </TabsTrigger>
                  <TabsTrigger value="contact" className="text-xs sm:text-sm flex-shrink-0">
                    Contato
                  </TabsTrigger>
                  <TabsTrigger value="identity" className="text-xs sm:text-sm flex-shrink-0">
                    Identidade
                  </TabsTrigger>
                  <TabsTrigger value="seo" className="text-xs sm:text-sm flex-shrink-0">
                    SEO
                  </TabsTrigger>
                  <TabsTrigger value="payment" className="text-xs sm:text-sm flex-shrink-0">
                    Pagamento
                  </TabsTrigger>
                  <TabsTrigger value="delivery" className="text-xs sm:text-sm flex-shrink-0">
                    Entrega
                  </TabsTrigger>
                  <TabsTrigger value="integrations" className="text-xs sm:text-sm flex-shrink-0">
                    Integrações
                  </TabsTrigger>
                  <TabsTrigger value="social" className="text-xs sm:text-sm flex-shrink-0">
                    Redes sociais
                  </TabsTrigger>
                </TabsList>

                {/* GERAL */}
                <TabsContent value="general" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Visibilidade</CardTitle>
                      <CardDescription>
                        Controla o que aparece no catálogo público.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <SwitchField
                          control={form.control}
                          name="isActive"
                          label="Catálogo ativo"
                          description="Quando off, o catálogo público fica fora do ar."
                        />
                        <SwitchField
                          control={form.control}
                          name="showPrices"
                          label="Mostrar preços"
                        />
                        <SwitchField
                          control={form.control}
                          name="showStock"
                          label="Mostrar estoque"
                          description="Exibe a quantidade disponível de cada produto."
                        />
                        <SwitchField
                          control={form.control}
                          name="showProductWithoutStock"
                          label="Mostrar produtos sem estoque"
                        />
                        <SwitchField
                          control={form.control}
                          name="allowOrders"
                          label="Permitir pedidos"
                          description="Habilita o botão de comprar no catálogo."
                        />
                      </div>

                      <Separator />

                      <FormField
                        control={form.control}
                        name="sortOrder"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ordenação dos produtos</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {SORT_ORDERS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* CONTATO */}
                <TabsContent value="contact" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Contato e endereço</CardTitle>
                      <CardDescription>
                        Dados de contato que aparecem na loja online.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="whatsappNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>WhatsApp</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="55 11 99999-0000"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <SwitchField
                          control={form.control}
                          name="showWhatsapp"
                          label="Exibir botão WhatsApp"
                        />
                        <FormField
                          control={form.control}
                          name="contactEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email de contato</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="email"
                                  placeholder="contato@suamarca.com"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="cnpj"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CNPJ</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="00.000.000/0000-00"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Separator />

                      {/* Endereço: 1 col em mobile, 2 em sm, 4 em md+. CEP fica
                          ao lado de "Número" no sm pra preencher melhor. */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <FormField
                          control={form.control}
                          name="cep"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CEP</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="00000-000"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2 md:col-span-2">
                              <FormLabel>Endereço</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Rua, avenida ou logradouro"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Ex: 123" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="district"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2 md:col-span-4">
                              <FormLabel>Bairro</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Ex: Centro" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* IDENTIDADE */}
                <TabsContent value="identity" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Identidade visual</CardTitle>
                      <CardDescription>
                        Logo, cor e banners que personalizam a loja.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <FormField
                        control={form.control}
                        name="logo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Logo (URL)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="https://exemplo.com/logo.png"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="theme"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cor principal</FormLabel>
                            {/* Color picker + hex: lado a lado a partir do
                                xs (`flex-1` no input ocupa o resto). */}
                            <div className="flex gap-2 items-center">
                              <FormControl>
                                <Input
                                  type="color"
                                  value={field.value || "#00bcd4"}
                                  onChange={field.onChange}
                                  className="w-12 sm:w-14 h-9 p-1 cursor-pointer shrink-0"
                                />
                              </FormControl>
                              <Input
                                {...field}
                                placeholder="#00bcd4"
                                className="font-mono flex-1 min-w-0"
                              />
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="bannerImagesText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Banners (uma URL por linha)</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                rows={4}
                                placeholder={
                                  "https://exemplo.com/banner-1.jpg\nhttps://exemplo.com/banner-2.jpg"
                                }
                                className="font-mono text-xs"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="aboutText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sobre a loja</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                rows={4}
                                placeholder="Conte a história da marca, missão, diferenciais…"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* SEO */}
                <TabsContent value="seo" className="mt-4 space-y-4">
                  {/* Domínio do catálogo: vive fora do form principal porque
                      usa `org.updateSubdomain` (não `catalogSettings.update`).
                      O dialog tem fluxo próprio: verificar → salvar. */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Domínio</CardTitle>
                      <CardDescription>
                        Endereço público do catálogo. Compartilhe esse link com
                        seus clientes e nas redes sociais.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <NerpSubdomainDialog />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>SEO</CardTitle>
                      <CardDescription>
                        Como sua loja aparece no Google e nas redes sociais.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <FormField
                        control={form.control}
                        name="metaTitle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Título (meta title)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Ex: Loja Acme — Eletrônicos com entrega rápida"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="metaDescription"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrição (meta description)</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                rows={3}
                                placeholder="Resumo curto que aparece embaixo do título nos resultados de busca."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* PAGAMENTO */}
                <TabsContent value="payment" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Métodos de pagamento aceitos</CardTitle>
                      <CardDescription>
                        Marque os métodos que aparecem como opção no checkout.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="paymentMethodSettings"
                        render={({ field }) => (
                          <FormItem>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {PAYMENT_METHODS.map((opt) => {
                                const checked = field.value.includes(opt.value);
                                return (
                                  <label
                                    key={opt.value}
                                    className="flex items-center gap-2 rounded border px-3 py-2 cursor-pointer hover:bg-muted/50"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(c) => {
                                        if (c) {
                                          field.onChange([
                                            ...field.value,
                                            opt.value,
                                          ]);
                                        } else {
                                          field.onChange(
                                            field.value.filter(
                                              (v) => v !== opt.value,
                                            ),
                                          );
                                        }
                                      }}
                                    />
                                    <span className="text-sm">{opt.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ENTREGA & FRETE */}
                <TabsContent value="delivery" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Métodos de entrega</CardTitle>
                      <CardDescription>
                        Como os produtos chegam até o cliente.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <FormField
                        control={form.control}
                        name="deliveryMethods"
                        render={({ field }) => (
                          <FormItem>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {DELIVERY_METHODS.map((opt) => {
                                const checked = field.value.includes(opt.value);
                                return (
                                  <label
                                    key={opt.value}
                                    className="flex items-center gap-2 rounded border px-3 py-2 cursor-pointer hover:bg-muted/50"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(c) => {
                                        if (c) {
                                          field.onChange([
                                            ...field.value,
                                            opt.value,
                                          ]);
                                        } else {
                                          field.onChange(
                                            field.value.filter(
                                              (v) => v !== opt.value,
                                            ),
                                          );
                                        }
                                      }}
                                    />
                                    <span className="text-sm">{opt.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="deliverySpecialInfo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Instruções de entrega</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                rows={3}
                                placeholder="Prazo médio, regiões atendidas, horários de retirada…"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Frete</CardTitle>
                      <CardDescription>
                        Modalidade de cobrança e regras de frete grátis.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="freightOptions"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Opção de frete</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {FREIGHT_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="freightChargeType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de cobrança</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {FREIGHT_CHARGE_TYPES.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="freightFixedValue"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Valor fixo (R$)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  placeholder="0,00"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="freightValuePerKg"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Valor por kg (R$)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  placeholder="0,00"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Separator />

                      <SwitchField
                        control={form.control}
                        name="freeShippingEnabled"
                        label="Frete grátis acima de um valor mínimo"
                      />
                      <FormField
                        control={form.control}
                        name="freeShippingMinValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valor mínimo para frete grátis (R$)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* INTEGRAÇÕES */}
                <TabsContent value="integrations" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Integrações</CardTitle>
                      <CardDescription>
                        Meta Pixel e gateway Asaas. (Stripe é gerenciado pelo nerp.)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="id_meta"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Meta — ID do negócio</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="ID da conta Meta Business"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="pixel_meta"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Meta — Pixel ID</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="ID do Pixel do Facebook/Instagram"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="walletId"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Asaas — Wallet ID</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="ID da carteira para split de pagamento"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* REDES SOCIAIS */}
                <TabsContent value="social" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Redes sociais</CardTitle>
                      <CardDescription>
                        Links exibidos no rodapé da loja. Use URLs completas.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(
                          [
                            { name: "instagram", label: "Instagram", placeholder: "https://instagram.com/suamarca" },
                            { name: "facebook", label: "Facebook", placeholder: "https://facebook.com/suamarca" },
                            { name: "twitter", label: "Twitter / X", placeholder: "https://x.com/suamarca" },
                            { name: "youtube", label: "YouTube", placeholder: "https://youtube.com/@suamarca" },
                            { name: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@suamarca" },
                            { name: "kwai", label: "Kwai", placeholder: "https://kwai.com/@suamarca" },
                          ] as const
                        ).map((s) => (
                          <FormField
                            key={s.name}
                            control={form.control}
                            name={s.name}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{s.label}</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder={s.placeholder} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Barra de ação sticky: full-width no mobile (botão fica largo
                  e fácil de tocar), recuada no desktop. Fundo opaco com blur
                  pra não vazar conteúdo por baixo. */}
              <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-background/85 backdrop-blur border-t sm:border-t-0 sm:bg-transparent sm:backdrop-blur-0 flex justify-stretch sm:justify-end z-10">
                <Button
                  type="submit"
                  disabled={update.isPending}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  {update.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Salvar configurações
                </Button>
              </div>
            </form>
          </Form>
        )}
      </NerpConnectionGuard>
    </NerpShell>
  );
}
