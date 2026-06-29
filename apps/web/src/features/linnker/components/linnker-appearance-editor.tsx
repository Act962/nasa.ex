"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { client, orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Plus, Trash2, Palette, Share2, User, ImageIcon, QrCode, IdCard } from "lucide-react";
import { LinnkerImageUploader } from "./linnker-image-uploader";
import type { LinnkerPage, LinnkerButtonStyle, SocialLink } from "../types";
import { SOCIAL_PLATFORMS } from "../types";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#64748b", "#1e293b", "#0f172a",
];

const BUTTON_STYLES: { value: LinnkerButtonStyle; label: string; preview: string }[] = [
  { value: "pill", label: "Pill", preview: "rounded-full" },
  { value: "rounded", label: "Arredondado", preview: "rounded-lg" },
  { value: "sharp", label: "Reto", preview: "rounded-none" },
];

// SVG icons para redes sociais
const SocialIcon = ({ platform, color }: { platform: string; color?: string }) => {
  const style = { color: color ?? "currentColor" };
  switch (platform) {
    case "instagram": return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" style={style}>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    );
    case "facebook": return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" style={style}>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
    case "tiktok": return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" style={style}>
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    );
    case "twitter": return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" style={style}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
    case "whatsapp": return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" style={style}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    );
    case "youtube": return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" style={style}>
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
    case "linkedin": return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" style={style}>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
    default: return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6" style={style}>
        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
};

interface Props {
  page: LinnkerPage;
  onRefetch: () => void;
  onPreviewChange?: (partial: Partial<LinnkerPage>) => void;
}

export function LinnkerAppearanceEditor({ page, onRefetch, onPreviewChange }: Props) {
  const [title, setTitle] = useState(page.title);
  const [bio, setBio] = useState(page.bio ?? "");
  const [coverColor, setCoverColor] = useState(page.coverColor);
  const [buttonStyle, setButtonStyle] = useState<LinnkerButtonStyle>(page.buttonStyle);
  const [customColor, setCustomColor] = useState(page.coverColor);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(page.avatarUrl ?? null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(page.bannerUrl ?? null);
  const [backgroundColor, setBackgroundColor] = useState(page.backgroundColor ?? "#f3f4f6");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(page.backgroundImage ?? null);
  const [backgroundOpacity, setBackgroundOpacity] = useState(page.backgroundOpacity ?? 0.15);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>((page.socialLinks as SocialLink[]) ?? []);
  const [socialIconColor, setSocialIconColor] = useState(page.socialIconColor ?? "#52525b");
  const [titleColor, setTitleColor] = useState(page.titleColor ?? "#111827");
  const [bioColor, setBioColor] = useState(page.bioColor ?? "#6b7280");
  const [qrEnabled, setQrEnabled] = useState<boolean>(page.qrEnabled ?? true);
  const [qrMessageTemplate, setQrMessageTemplate] = useState<string>(
    page.qrMessageTemplate ?? "Olá! Te conheci pelo QR no evento. Quero saber mais sobre {org} 👋",
  );
  // vCard overrides — alimentam o `.vcf` baixado pelo botão "Baixar
  // contato" ou pelo iPhone após escanear o QR.
  const [vcardFirstName, setVcardFirstName] = useState(page.vcardOverrides?.firstName ?? "");
  const [vcardLastName, setVcardLastName] = useState(page.vcardOverrides?.lastName ?? "");
  const [vcardJobTitle, setVcardJobTitle] = useState(page.vcardOverrides?.jobTitle ?? "");
  const [vcardCompany, setVcardCompany] = useState(page.vcardOverrides?.company ?? "");
  const [vcardPhone, setVcardPhone] = useState(page.vcardOverrides?.phone ?? "");
  const [vcardEmail, setVcardEmail] = useState(page.vcardOverrides?.email ?? "");
  const [vcardBirthday, setVcardBirthday] = useState(page.vcardOverrides?.birthday ?? "");
  const [vcardWebsite, setVcardWebsite] = useState(page.vcardOverrides?.website ?? "");
  const [vcardNotes, setVcardNotes] = useState(page.vcardOverrides?.notes ?? "");

  const [activeSection, setActiveSection] = useState<"profile" | "colors" | "background" | "social" | "qr" | "vcard">("profile");

  // Sincroniza estado quando page é atualizada após save + refetch
  useEffect(() => {
    setTitle(page.title);
    setBio(page.bio ?? "");
    setCoverColor(page.coverColor);
    setCustomColor(page.coverColor);
    setButtonStyle(page.buttonStyle);
    setAvatarUrl(page.avatarUrl ?? null);
    setBannerUrl(page.bannerUrl ?? null);
    setBackgroundColor(page.backgroundColor ?? "#f3f4f6");
    setBackgroundImage(page.backgroundImage ?? null);
    setBackgroundOpacity(page.backgroundOpacity ?? 0.15);
    setSocialLinks((page.socialLinks as SocialLink[]) ?? []);
    setSocialIconColor(page.socialIconColor ?? "#52525b");
    setTitleColor(page.titleColor ?? "#111827");
    setBioColor(page.bioColor ?? "#6b7280");
    setQrEnabled(page.qrEnabled ?? true);
    setQrMessageTemplate(
      page.qrMessageTemplate ??
        "Olá! Te conheci pelo QR no evento. Quero saber mais sobre {org} 👋",
    );
    setVcardFirstName(page.vcardOverrides?.firstName ?? "");
    setVcardLastName(page.vcardOverrides?.lastName ?? "");
    setVcardJobTitle(page.vcardOverrides?.jobTitle ?? "");
    setVcardCompany(page.vcardOverrides?.company ?? "");
    setVcardPhone(page.vcardOverrides?.phone ?? "");
    setVcardEmail(page.vcardOverrides?.email ?? "");
    setVcardBirthday(page.vcardOverrides?.birthday ?? "");
    setVcardWebsite(page.vcardOverrides?.website ?? "");
    setVcardNotes(page.vcardOverrides?.notes ?? "");
  }, [page.id]); // re-inicializa apenas se mudar de página

  const { data: resourcesData } = useQuery(orpc.linnker.getResources.queryOptions({}));

  // Emite mudanças em tempo real para o preview
  useEffect(() => {
    onPreviewChange?.({
      title, bio: bio || null, coverColor, buttonStyle,
      avatarUrl, bannerUrl, backgroundColor,
      backgroundImage, backgroundOpacity,
      socialLinks: socialLinks.length > 0 ? socialLinks : null,
      socialIconColor, titleColor, bioColor,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, bio, coverColor, buttonStyle, avatarUrl, bannerUrl, backgroundColor, backgroundImage, backgroundOpacity, socialLinks, socialIconColor, titleColor, bioColor]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      client.linnker.updatePage({
        id: page.id,
        title, bio, coverColor, buttonStyle, avatarUrl, bannerUrl,
        backgroundColor,
        backgroundImage,
        backgroundOpacity,
        socialIconColor,
        titleColor,
        bioColor,
        qrEnabled,
        qrMessageTemplate: qrMessageTemplate.trim() || null,
        vcardOverrides: (() => {
          // Normaliza: vazio vira null pro overall obj, e cada campo
          // vazio vira null pra cair no default do builder.
          const ov = {
            firstName: vcardFirstName.trim() || null,
            lastName: vcardLastName.trim() || null,
            jobTitle: vcardJobTitle.trim() || null,
            company: vcardCompany.trim() || null,
            phone: vcardPhone.replace(/\D+/g, "").trim() || null,
            email: vcardEmail.trim() || null,
            birthday: vcardBirthday.trim() || null,
            website: vcardWebsite.trim() || null,
            notes: vcardNotes.trim() || null,
          };
          const hasAny = Object.values(ov).some((v) => v);
          return hasAny ? ov : null;
        })(),
        socialLinks: socialLinks.filter((s) => s.url.trim()).length > 0
          ? socialLinks.filter((s) => s.url.trim())
          : null,
      }),
    onSuccess: () => { toast.success("Aparência atualizada!"); onRefetch(); },
    onError: () => toast.error("Erro ao salvar"),
  });

  const addSocialLink = () => setSocialLinks((p) => [...p, { platform: "instagram", url: "" }]);
  const removeSocialLink = (i: number) => setSocialLinks((p) => p.filter((_, idx) => idx !== i));
  const updateSocialLink = (i: number, field: keyof SocialLink, value: string) =>
    setSocialLinks((p) => p.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const useOrgLogo = () => {
    const logo = (resourcesData as any)?.orgLogo ?? null;
    if (logo) { setAvatarUrl(logo); toast.success("Logo da empresa aplicado!"); }
    else toast.error("Nenhum logo encontrado. Cadastre em Configurações > Marca.");
  };

  const setColor = (c: string) => { setCoverColor(c); setCustomColor(c); };

  const sections = [
    { key: "profile", label: "Perfil", icon: User },
    { key: "colors", label: "Cores", icon: Palette },
    { key: "background", label: "Fundo", icon: ImageIcon },
    { key: "social", label: "Social", icon: Share2 },
    { key: "vcard", label: "Cartão", icon: IdCard },
    { key: "qr", label: "QR", icon: QrCode },
  ] as const;

  // Extrai phone do WhatsApp pra preview do wa.me URL
  const previewPhone = (() => {
    const wpp = socialLinks.find((l) => l.platform?.toLowerCase() === "whatsapp");
    if (!wpp?.url) return null;
    const digits = wpp.url.replace(/\D+/g, "");
    if (digits.length < 8) return null;
    return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  })();

  return (
    <div className="space-y-5">
      {/* Section tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {sections.map((s) => (
          <button key={s.key} type="button" onClick={() => setActiveSection(s.key)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-md text-xs font-medium transition-colors ${
              activeSection === s.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <s.icon className="size-3.5" />{s.label}
          </button>
        ))}
      </div>

      {/* ── PERFIL ── */}
      {activeSection === "profile" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Título / Nome</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">Cor</span>
                <input
                  type="color"
                  value={titleColor}
                  onChange={(e) => setTitleColor(e.target.value)}
                  className="size-6 rounded cursor-pointer border"
                  title="Cor do título"
                />
              </div>
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ color: titleColor }}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Descrição / Bio</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">Cor</span>
                <input
                  type="color"
                  value={bioColor}
                  onChange={(e) => setBioColor(e.target.value)}
                  className="size-6 rounded cursor-pointer border"
                  title="Cor da descrição"
                />
              </div>
            </div>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Uma breve descrição..."
              style={{ color: bioColor }}
            />
          </div>

          {/* Cor principal (também aqui para acesso rápido) */}
          <div className="space-y-2">
            <Label className="text-xs">Cor principal</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`size-7 rounded-full border-2 transition-transform hover:scale-110 ${coverColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
              <input type="color" value={customColor}
                onChange={(e) => setColor(e.target.value)}
                className="size-7 rounded cursor-pointer border"
                title="Cor personalizada"
              />
            </div>
            {/* Preview mini dos botões */}
            <div className="flex gap-2">
              {BUTTON_STYLES.map((s) => (
                <button key={s.value} type="button" onClick={() => setButtonStyle(s.value)}
                  className={`flex-1 py-1.5 text-white text-[10px] font-medium transition-all ${s.preview} ${buttonStyle === s.value ? "ring-2 ring-foreground ring-offset-1" : "opacity-70 hover:opacity-100"}`}
                  style={{ background: coverColor }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Foto de perfil</Label>
            <div className="flex items-start gap-4">
              <LinnkerImageUploader value={avatarUrl} onChange={setAvatarUrl} aspectRatio="square" className="shrink-0" />
              <div className="flex-1 pt-1 space-y-2">
                <p className="text-xs text-muted-foreground">Imagem circular exibida no centro</p>
                <Button type="button" variant="outline" size="sm" className="text-xs w-full" onClick={useOrgLogo}>
                  Usar logo da empresa
                </Button>
              </div>
            </div>
          </div>
          <LinnkerImageUploader value={bannerUrl} onChange={setBannerUrl} label="Banner do topo (imagem horizontal)" aspectRatio="banner" />
        </div>
      )}

      {/* ── CORES ── */}
      {activeSection === "colors" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Cor principal dos botões</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`size-8 rounded-full border-2 transition-transform hover:scale-110 ${coverColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="color" value={customColor} onChange={(e) => setColor(e.target.value)} className="size-8 rounded cursor-pointer border" />
              <Input value={customColor} onChange={(e) => setColor(e.target.value)} className="font-mono text-sm" placeholder="#6366f1" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Estilo dos botões</Label>
            <RadioGroup value={buttonStyle} onValueChange={(v) => setButtonStyle(v as LinnkerButtonStyle)} className="flex gap-3">
              {BUTTON_STYLES.map((s) => (
                <div key={s.value} className="flex-1">
                  <RadioGroupItem value={s.value} id={`btn-${s.value}`} className="sr-only" />
                  <label htmlFor={`btn-${s.value}`}
                    className={`block cursor-pointer border-2 p-3 transition-colors ${buttonStyle === s.value ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"} ${s.preview}`}
                  >
                    <div className={`h-8 w-full ${s.preview}`} style={{ background: coverColor, opacity: 0.7 }} />
                    <p className="text-xs text-center mt-2 font-medium">{s.label}</p>
                  </label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
      )}

      {/* ── FUNDO ── */}
      {activeSection === "background" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Cor de fundo</Label>
            <div className="flex flex-wrap gap-2">
              {["#f3f4f6", "#ffffff", "#0f172a", "#1e293b", "#fef9c3", "#fce7f3", "#ede9fe", "#dcfce7", "#dbeafe"].map((c) => (
                <button key={c} type="button" onClick={() => setBackgroundColor(c)}
                  className={`size-8 rounded-full border-2 transition-transform hover:scale-110 ${backgroundColor === c ? "border-foreground scale-110" : "border-border"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="size-8 rounded cursor-pointer border" />
              <Input value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="font-mono text-sm" placeholder="#f3f4f6" />
            </div>
          </div>

          <LinnkerImageUploader value={backgroundImage} onChange={setBackgroundImage} label="Imagem de fundo (opcional)" aspectRatio="banner" />

          {backgroundImage && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Opacidade da imagem</Label>
                <span className="text-xs text-muted-foreground font-mono">{Math.round(backgroundOpacity * 100)}%</span>
              </div>
              <Slider min={0} max={1} step={0.05} value={[backgroundOpacity]} onValueChange={([v]) => setBackgroundOpacity(v)} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Transparente</span><span>Opaco</span>
              </div>
            </div>
          )}

          <div className="w-full h-16 rounded-lg border relative overflow-hidden" style={{ background: backgroundColor }}>
            {backgroundImage && (
              <img src={backgroundImage} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: backgroundOpacity }} />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm font-bold drop-shadow" style={{ color: coverColor }}>Preview do fundo</p>
            </div>
          </div>
        </div>
      )}

      {/* ── REDES SOCIAIS ── */}
      {activeSection === "social" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Ícones exibidos no rodapé da página pública.</p>

          <div className="space-y-2">
            <Label className="text-xs">Cor dos ícones</Label>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {["#52525b", "#ffffff", "#000000", "#6366f1", "#ec4899", "#22c55e", "#f97316"].map((c) => (
                  <button key={c} type="button" onClick={() => setSocialIconColor(c)}
                    className={`size-7 rounded-full border-2 transition-transform hover:scale-110 ${socialIconColor === c ? "border-foreground scale-110" : "border-border"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <input type="color" value={socialIconColor} onChange={(e) => setSocialIconColor(e.target.value)} className="size-7 rounded cursor-pointer border" />
            </div>
            {socialLinks.filter((s) => s.url.trim()).length > 0 && (
              <div className="flex gap-4 py-2 px-3 bg-muted/30 rounded-lg flex-wrap">
                {socialLinks.filter((s) => s.url.trim()).map((s, i) => (
                  <SocialIcon key={i} platform={s.platform} color={socialIconColor} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {socialLinks.map((sl, i) => (
              <div key={i} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/20">
                <SocialIcon platform={sl.platform} color={socialIconColor} />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <select value={sl.platform} onChange={(e) => updateSocialLink(i, "platform", e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border rounded-md bg-background">
                    {SOCIAL_PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                  <Input
                    placeholder={SOCIAL_PLATFORMS.find((p) => p.key === sl.platform)?.placeholder ?? "https://..."}
                    value={sl.url} onChange={(e) => updateSocialLink(i, "url", e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive shrink-0" onClick={() => removeSocialLink(i)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {socialLinks.length < 8 && (
            <Button type="button" variant="outline" size="sm" className="w-full border-dashed" onClick={addSocialLink}>
              <Plus className="size-3.5 mr-1.5" /> Adicionar rede social
            </Button>
          )}
        </div>
      )}

      {/* ── Cartão de Visita (.vcf) ──────────────────────────── */}
      {activeSection === "vcard" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <IdCard className="size-3.5" />
              Cartão de contato (.vcf)
            </p>
            <p className="text-muted-foreground">
              Esses campos vão pro arquivo <code className="font-mono">.vcf</code> que
              a pessoa baixa ao clicar em "Baixar meu contato" no popup do
              QR. Quando aberto no iPhone (Safari/Mail), o iOS mostra
              "Adicionar aos Contatos" com tudo pré-preenchido.
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Deixe vazio</strong> pra usar os valores padrão (nome
              da página, organização, WhatsApp do social link, etc).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Primeiro nome</Label>
              <Input
                value={vcardFirstName}
                onChange={(e) => setVcardFirstName(e.target.value)}
                placeholder={page.title.split(" ")[0] ?? ""}
                className="text-xs h-9 mt-1"
                maxLength={100}
              />
            </div>
            <div>
              <Label className="text-xs">Sobrenome</Label>
              <Input
                value={vcardLastName}
                onChange={(e) => setVcardLastName(e.target.value)}
                placeholder={page.title.split(" ").slice(1).join(" ") || ""}
                className="text-xs h-9 mt-1"
                maxLength={100}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Cargo / função</Label>
            <Input
              value={vcardJobTitle}
              onChange={(e) => setVcardJobTitle(e.target.value)}
              placeholder="Ex: CEO, Designer, Consultor"
              className="text-xs h-9 mt-1"
              maxLength={200}
            />
          </div>

          <div>
            <Label className="text-xs">Empresa</Label>
            <Input
              value={vcardCompany}
              onChange={(e) => setVcardCompany(e.target.value)}
              placeholder="Default: nome da sua organização NASA"
              className="text-xs h-9 mt-1"
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input
                value={vcardPhone}
                onChange={(e) => setVcardPhone(e.target.value)}
                placeholder="5586999999999"
                className="text-xs h-9 mt-1 font-mono"
                maxLength={20}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Só dígitos. Default: WhatsApp do Social.
              </p>
            </div>
            <div>
              <Label className="text-xs">Aniversário</Label>
              <Input
                type="date"
                value={vcardBirthday}
                onChange={(e) => setVcardBirthday(e.target.value)}
                className="text-xs h-9 mt-1"
                max="2026-12-31"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={vcardEmail}
              onChange={(e) => setVcardEmail(e.target.value)}
              placeholder="Default: email do seu usuário NASA"
              className="text-xs h-9 mt-1"
              maxLength={200}
            />
          </div>

          <div>
            <Label className="text-xs">Site pessoal (extra)</Label>
            <Input
              value={vcardWebsite}
              onChange={(e) => setVcardWebsite(e.target.value)}
              placeholder="https://meusite.com"
              className="text-xs h-9 mt-1 font-mono"
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              O link do Linnker já vai automático. Esse é um extra.
            </p>
          </div>

          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea
              value={vcardNotes}
              onChange={(e) => setVcardNotes(e.target.value)}
              placeholder="Default: sua bio. Pode customizar pra ficar diferente do que aparece no perfil."
              rows={3}
              className="text-xs mt-1"
              maxLength={1000}
            />
          </div>

          {/* Link pra baixar o .vcf atual pra testar */}
          <a
            href={`/api/linnker/${page.slug}/vcard`}
            download
            className="block text-center text-xs underline text-indigo-600 hover:text-indigo-700"
          >
            ⬇ Testar download do meu cartão atual (.vcf)
          </a>
        </div>
      )}

      {/* ── QR Code de Contato ───────────────────────────────── */}
      {activeSection === "qr" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <QrCode className="size-3.5" />
              QR Code de contato
            </p>
            <p className="text-muted-foreground">
              Mostra um botão de QR ao lado da sua foto na página
              pública. Ao escanear, abre WhatsApp com mensagem
              pré-digitada. O scan fica registrado e pode disparar
              workflow no seu tracking.
            </p>
          </div>

          {!previewPhone && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 leading-relaxed">
              ⚠ Adicione um link de WhatsApp em <strong>Social</strong>
              {" "}primeiro. O QR usa esse número como destino.
            </div>
          )}

          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
            <div className="min-w-0">
              <Label className="text-xs font-semibold">Mostrar QR no perfil público</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Sem isso, o botão de QR não aparece pra visitantes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQrEnabled((v) => !v)}
              role="switch"
              aria-checked={qrEnabled}
              className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
                qrEnabled ? "bg-indigo-500" : "bg-zinc-300"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                  qrEnabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div>
            <Label className="text-xs font-semibold">Mensagem template</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5 mb-1.5">
              Texto que vai pré-preencher no WhatsApp da pessoa que
              escaneou. Use <code className="font-mono bg-muted px-1 rounded">{"{org}"}</code> pra
              inserir o nome da sua empresa automaticamente.
            </p>
            <Textarea
              rows={3}
              value={qrMessageTemplate}
              onChange={(e) => setQrMessageTemplate(e.target.value)}
              placeholder="Olá! Te conheci pelo QR no evento. Quero saber mais sobre {org} 👋"
              className="text-xs"
              maxLength={500}
            />
          </div>

          {previewPhone && (
            <div className="rounded-md border bg-white p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                Preview do link
              </p>
              <code className="text-[10px] font-mono break-all text-zinc-700">
                wa.me/{previewPhone}?text=
                {encodeURIComponent(
                  qrMessageTemplate.replace(/\{org\}/g, "Sua Empresa"),
                ).slice(0, 80)}
                …
              </code>
            </div>
          )}
        </div>
      )}

      <Button onClick={() => save()} disabled={isPending} className="w-full">
        {isPending ? "Salvando..." : "Salvar aparência"}
      </Button>
    </div>
  );
}
