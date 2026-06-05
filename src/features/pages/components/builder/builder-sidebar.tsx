"use client";

import { useState } from "react";
import {
  Type, Image as ImageIcon, Square, Minus, MousePointerClick,
  Video as VideoIcon, Share2, Link as LinkIcon, Code2,
  Star as StarIcon, Shapes, SquareStack, LayoutTemplate,
  Settings2, LayoutGrid, DollarSign, Megaphone, BarChart3,
  Quote, HelpCircle, Building2, MoveHorizontal, Layers,
  Rows3, Hash, Database,
} from "lucide-react";
import { toast } from "sonner";
import {
  usePagesBuilderStore,
  getActiveLayerElements,
} from "../../context/pages-builder-store";
import { createElement } from "../../lib/element-factory";
import { computeInsertPosition } from "../../lib/insert-position";
import type { ElementType } from "../../types";

/**
 * Elementos "singleton" — só podem existir 1 instância por page:
 * - chat-button   → flutuante fixo no canto, 2 ficaria sobreposto
 * - exit-intent   → modal de saída, 2 disparariam simultâneo
 * - section-navbar → cabeçalho único da landing
 * - section-footer → rodapé único da landing
 *
 * Toast user-friendly explica em vez de só rejeitar silenciosamente.
 */
const SINGLETON_TYPES = new Set<ElementType>([
  "chat-button",
  "exit-intent",
  "section-navbar",
  "section-footer",
]);

const SINGLETON_LABELS: Record<string, string> = {
  "chat-button": "Chat IA flutuante",
  "exit-intent": "Exit intent",
  "section-navbar": "Navbar",
  "section-footer": "Footer",
};
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PropertiesPanelContent } from "../properties-panel/properties-panel";

const ICONS: Record<ElementType, React.ComponentType<{ className?: string }>> = {
  text:                  Type,
  image:                 ImageIcon,
  svg:                   Shapes,
  shape:                 Square,
  divider:               Minus,
  icon:                  StarIcon,
  button:                MousePointerClick,
  video:                 VideoIcon,
  social:                Share2,
  spacer:                SquareStack,
  "nasa-link":           LinkIcon,
  embed:                 Code2,
  group:                 SquareStack,
  "section-hero":        LayoutTemplate,
  "section-features":    LayoutGrid,
  "section-pricing":     DollarSign,
  "section-cta":         Megaphone,
  "section-stats":       BarChart3,
  "section-testimonials": Quote,
  "section-faq":         HelpCircle,
  "section-logo-cloud":  Building2,
  marquee:               MoveHorizontal,
  tabs:                  Layers,
  accordion:             Rows3,
  counter:               Hash,
  "data-bound":          Database,
};

const LABELS: Record<ElementType, string> = {
  text:                  "Texto",
  image:                 "Imagem",
  svg:                   "SVG",
  shape:                 "Forma",
  divider:               "Divisor",
  icon:                  "Ícone",
  button:                "Botão",
  video:                 "Vídeo",
  social:                "Social",
  spacer:                "Espaço",
  "nasa-link":           "Link NASA",
  embed:                 "Embed",
  group:                 "Grupo",
  "section-hero":        "Hero",
  "section-features":    "Features",
  "section-pricing":     "Pricing",
  "section-cta":         "CTA",
  "section-stats":       "Stats",
  "section-testimonials": "Depoimentos",
  "section-faq":         "FAQ",
  "section-logo-cloud":  "Logos",
  marquee:               "Marquee",
  tabs:                  "Tabs",
  accordion:             "Accordion",
  counter:               "Contador",
  "data-bound":          "Data bound",
};

const ELEMENT_ORDER: ElementType[] = [
  "text", "image", "button", "shape", "divider",
  "icon", "video", "social", "spacer", "nasa-link", "embed",
  "carousel", "chat-button", "embedded-form", "exit-intent",
];

// ─── Predefined section templates ───────────────────────────────────────────

const BLOCKS = [
  {
    label: "Hero com título",
    preview: "bg-gradient-to-br from-indigo-500 to-purple-600",
    elements: () => [
      { type: "shape" as ElementType, x: 0, y: 0, w: 1440, h: 520, shape: "rect", fill: "#6366f1", borderRadius: 0, zIndex: 0 },
      { type: "text" as ElementType, x: 120, y: 140, w: 700, h: 80, content: "Seu título impactante aqui", color: "#ffffff", fontSize: 52, fontFamily: "Inter", fontWeight: "700", align: "left", zIndex: 1 },
      { type: "text" as ElementType, x: 120, y: 240, w: 580, h: 60, content: "Subtítulo com descrição curta e objetiva para o visitante", color: "#e0e7ff", fontSize: 20, fontFamily: "Inter", align: "left", zIndex: 1 },
      { type: "button" as ElementType, x: 120, y: 330, w: 180, h: 52, label: "Começar agora", bg: "#ffffff", fg: "#6366f1", radius: 12, zIndex: 1 },
    ],
  },
  {
    label: "Header com nav",
    preview: "bg-white border",
    elements: () => [
      { type: "shape" as ElementType, x: 0, y: 0, w: 1440, h: 72, shape: "rect", fill: "#ffffff", borderRadius: 0, zIndex: 0 },
      { type: "text" as ElementType, x: 32, y: 20, w: 180, h: 36, content: "Minha Marca", color: "#1e293b", fontSize: 22, fontFamily: "Inter", fontWeight: "700", align: "left", zIndex: 1 },
      { type: "button" as ElementType, x: 1220, y: 16, w: 140, h: 40, label: "Entrar em contato", bg: "#6366f1", fg: "#ffffff", radius: 8, zIndex: 1 },
    ],
  },
  {
    label: "Rodapé simples",
    preview: "bg-slate-900",
    elements: () => [
      { type: "shape" as ElementType, x: 0, y: 0, w: 1440, h: 120, shape: "rect", fill: "#0f172a", borderRadius: 0, zIndex: 0 },
      { type: "text" as ElementType, x: 120, y: 44, w: 400, h: 36, content: "© 2025 Minha Empresa. Todos os direitos reservados.", color: "#94a3b8", fontSize: 14, fontFamily: "Inter", align: "left", zIndex: 1 },
    ],
  },
  {
    label: "3 recursos",
    preview: "bg-slate-50",
    elements: () => [
      { type: "text" as ElementType, x: 120, y: 48, w: 1200, h: 60, content: "Nossas vantagens", color: "#1e293b", fontSize: 36, fontFamily: "Inter", fontWeight: "700", align: "center", zIndex: 1 },
      ...([0, 1, 2] as const).flatMap((i) => [
        { type: "shape" as ElementType, x: 120 + i * 420, y: 140, w: 380, h: 220, shape: "rect", fill: "#f8fafc", borderRadius: 16, zIndex: 1 },
        { type: "text" as ElementType, x: 160 + i * 420, y: 180, w: 300, h: 40, content: `Recurso ${i + 1}`, color: "#1e293b", fontSize: 20, fontFamily: "Inter", fontWeight: "600", align: "left", zIndex: 2 },
        { type: "text" as ElementType, x: 160 + i * 420, y: 232, w: 300, h: 80, content: "Descrição breve do benefício principal para o usuário.", color: "#64748b", fontSize: 15, fontFamily: "Inter", align: "left", zIndex: 2 },
      ]),
    ],
  },
  {
    label: "CTA centralizado",
    preview: "bg-indigo-50",
    elements: () => [
      { type: "shape" as ElementType, x: 0, y: 0, w: 1440, h: 280, shape: "rect", fill: "#eef2ff", borderRadius: 0, zIndex: 0 },
      { type: "text" as ElementType, x: 320, y: 60, w: 800, h: 80, content: "Pronto para começar?", color: "#1e293b", fontSize: 40, fontFamily: "Inter", fontWeight: "700", align: "center", zIndex: 1 },
      { type: "button" as ElementType, x: 580, y: 168, w: 280, h: 52, label: "Falar com especialista", bg: "#6366f1", fg: "#ffffff", radius: 12, zIndex: 1 },
    ],
  },
];

type Tab = "elements" | "blocks" | "page";

/**
 * Versão drawer/sheet: mesmo conteúdo do BuilderSidebar mas SEM o
 * `<aside>` wrapper. Pra usar dentro de `<SheetContent>` quando em
 * mobile (sidebar lateral vira gaveta deslizante).
 */
export function BuilderSidebarPanel() {
  return <BuilderSidebarBody asPanel />;
}

export function BuilderSidebar() {
  return <BuilderSidebarBody />;
}

function BuilderSidebarBody({ asPanel = false }: { asPanel?: boolean }) {
  const [tab, setTab] = useState<Tab>("elements");
  const addElement = usePagesBuilderStore((s) => s.addElement);
  const updateArtboard = usePagesBuilderStore((s) => s.updateArtboard);
  const layout = usePagesBuilderStore((s) => s.layout);
  const selected = usePagesBuilderStore((s) => s.selected);

  // Posiciona o elemento no centro da viewport visível (pra free
  // elements) ou no fim da pilha (pra flow sections). Antes ficavam
  // todos em x:0 y:0 — apareciam atrás dos blocos, "sumindo".
  const handleAdd = (t: ElementType) => {
    const lay = usePagesBuilderStore.getState().layout;
    const layer = usePagesBuilderStore.getState().activeLayer;
    const zoom = usePagesBuilderStore.getState().zoom;
    const base = createElement(t, {});
    if (!lay) {
      addElement(base);
      return;
    }
    const existing = getActiveLayerElements(lay, layer);

    // Singleton elements: em vez de bloquear, SELECIONA o existente
    // pra o user editar. Mais útil que toast.error "já tem 1".
    if (SINGLETON_TYPES.has(t)) {
      const existingOfType = existing.find((el) => el.type === t);
      if (existingOfType) {
        const label = SINGLETON_LABELS[t] ?? t;
        usePagesBuilderStore.getState().setSelected([existingOfType.id]);
        toast.info(`Já existe 1 ${label} — selecionei pra você editar.`, {
          description: "Esse tipo só pode existir 1× por page. Edite no painel direito.",
        });
        return;
      }
    }

    const pos = computeInsertPosition({
      type: t,
      w: base.w,
      h: base.h,
      existingElements: existing,
      zoom,
      artboardWidth: lay.artboard.width ?? 1440,
    });
    addElement({ ...base, x: pos.x, y: pos.y });
  };

  // Blocos pré-feitos (heros completos com text+button+shape juntos)
  // — sobe TODOS pro fim da pilha mantendo a relação interna entre os
  // elementos do bloco (offsets relativos preservados).
  const handleBlock = (block: (typeof BLOCKS)[number]) => {
    const { nanoid } = require("nanoid");
    const lay = usePagesBuilderStore.getState().layout;
    const layer = usePagesBuilderStore.getState().activeLayer;
    const els = block.elements();
    if (!lay || els.length === 0) {
      els.forEach((el) =>
        addElement({ ...el, id: `el_${nanoid(10)}` } as never),
      );
      return;
    }
    const existing = getActiveLayerElements(lay, layer);
    // y mínimo do bloco (offset interno) — todos os elementos vão
    // ser deslocados por esse offset pra ficar no topo, depois +
    // bottom da pilha existente.
    const minY = Math.min(...els.map((e) => e.y));
    const stackBottom = existing.reduce(
      (m, e) => Math.max(m, e.y + e.h),
      0,
    );
    els.forEach((el) => {
      addElement({
        ...el,
        id: `el_${nanoid(10)}`,
        y: el.y - minY + stackBottom,
      } as never);
    });
  };

  const bgColor = layout?.artboard.background ?? "#ffffff";

  const wrapperCls = asPanel
    ? "w-full h-full flex flex-col overflow-hidden bg-card"
    : "w-[300px] border-r bg-card hidden md:flex flex-col shrink-0 overflow-hidden";
  const Tag: React.ElementType = asPanel ? "div" : "aside";

  return (
    <Tag data-builder-sidebar className={wrapperCls}>
      {/* tab bar */}
      <div className="flex border-b shrink-0">
        {([
          { id: "elements", icon: SquareStack, tip: "Elementos" },
          { id: "blocks",   icon: LayoutTemplate, tip: "Blocos" },
          { id: "page",     icon: Settings2, tip: "Página" },
        ] as { id: Tab; icon: React.ComponentType<{ className?: string }>; tip: string }[]).map(({ id, icon: Icon, tip }) => (
          <button
            key={id}
            title={tip}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 py-2.5 flex justify-center items-center gap-1.5 text-xs transition-colors",
              tab === id
                ? "bg-indigo-50 text-indigo-600 border-b-2 border-indigo-500"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="font-medium">{tip}</span>
          </button>
        ))}
      </div>

      {/* scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "elements" && (
          <div className="py-2">
            <p className="px-3 text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Elementos</p>
            <div className="flex flex-col gap-0.5 px-2">
              {ELEMENT_ORDER.map((t) => {
                const Icon = ICONS[t] ?? SquareStack;
                return (
                  <button
                    key={t}
                    onClick={() => handleAdd(t)}
                    className="flex items-center gap-3 px-2 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span>{LABELS[t] ?? t}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === "blocks" && (
          <div className="py-2">
            <p className="px-3 text-[10px] font-semibold uppercase text-muted-foreground mb-2">Blocos prontos</p>
            <div className="flex flex-col gap-2 px-2">
              {BLOCKS.map((b, i) => (
                <button
                  key={i}
                  onClick={() => handleBlock(b)}
                  className="text-left rounded-lg border hover:border-indigo-500 transition-colors overflow-hidden"
                >
                  <div className={cn("h-10 w-full", b.preview)} />
                  <div className="px-3 py-2 text-xs font-medium">{b.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "page" && (
          <PageSettingsPanel
            bgColor={bgColor}
            updateArtboard={updateArtboard}
            layout={layout}
          />
        )}

        {/* ─── Properties panel embutido ─────────────────────────────── */}
        {selected.length > 0 ? (
          <PropertiesPanelContent />
        ) : (
          // Empty state educativo — mostra DESTACADO quando nada está
          // selecionado. Usuário tá confuso: "criou só uma imagem
          // fixa?". Não é fixa — cada bloco é editável. Esse hint
          // resolve a falha de discoverability.
          <div className="mt-2 mx-2 mb-3 rounded-lg border-2 border-dashed border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 text-center">
            <div className="text-2xl mb-1.5">👆</div>
            <p className="text-xs font-semibold text-indigo-900 leading-tight mb-1.5">
              Clique em qualquer bloco no canvas
            </p>
            <p className="text-[11px] text-indigo-700/80 leading-relaxed">
              Cada seção (hero, navbar, features, footer…) é{" "}
              <strong>editável</strong>. Quando você clica, este painel
              mostra todos os campos: <em>título, subtítulo, textos,
              imagens, botões, links, cores</em> — tudo dá pra trocar.
            </p>
            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-white border px-2 py-0.5">
                <span className="size-1.5 rounded-full bg-indigo-500" />
                Dica
              </span>
              <span>arrasta também pra mover</span>
            </div>
          </div>
        )}
      </div>
    </Tag>
  );
}

/**
 * Configurações da página inteira — aparência básica (background,
 * height) + tracking (Meta Pixel, Google Analytics, UTM defaults).
 *
 * UTM defaults: usados quando alguém chega na page SEM utm na URL.
 * O lead criado herda esses valores. Útil pra campanhas externas
 * que esquecem de adicionar UTM.
 *
 * Tracking IDs (Meta Pixel, GA, GTM) ficam no `layout.meta` — sem
 * migration. O public renderer injeta os scripts no client.
 */
function PageSettingsPanel({
  bgColor,
  updateArtboard,
  layout,
}: {
  bgColor: string;
  updateArtboard: (p: Partial<{ background: string; minHeight: number }>) => void;
  layout: ReturnType<typeof usePagesBuilderStore.getState>["layout"];
}) {
  const updateMeta = usePagesBuilderStore((s) => s.updateMeta);
  const meta =
    ((layout as unknown as { meta?: Record<string, unknown> })?.meta ?? {}) as Record<
      string,
      string | undefined
    >;

  return (
    <div className="py-2 px-3">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-3">
        Aparência da página
      </p>
      <div className="space-y-4">
        <div>
          <Label className="text-[11px] text-muted-foreground">Cor de fundo</Label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="color"
              value={bgColor}
              onChange={(e) => updateArtboard({ background: e.target.value })}
              className="size-9 rounded border cursor-pointer p-0.5 bg-transparent"
            />
            <span className="text-xs font-mono text-muted-foreground">{bgColor}</span>
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Altura mínima (px)</Label>
          <input
            type="number"
            min={400}
            step={100}
            value={layout?.artboard.minHeight ?? 800}
            onChange={(e) => updateArtboard({ minHeight: Number(e.target.value) })}
            className="mt-1 w-full h-8 rounded border px-2 text-xs bg-background"
          />
        </div>
      </div>

      <hr className="my-4" />

      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
        Pixels & Analytics
      </p>
      <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
        IDs injetados no <code className="font-mono">&lt;head&gt;</code> da
        página pública. Funcionam só após publicar.
      </p>
      <div className="space-y-3">
        <div>
          <Label className="text-[11px] text-muted-foreground">Meta Pixel ID</Label>
          <input
            type="text"
            value={meta.metaPixelId ?? ""}
            onChange={(e) => updateMeta({ metaPixelId: e.target.value || undefined })}
            placeholder="123456789012345"
            className="mt-1 w-full h-8 rounded border px-2 text-xs bg-background font-mono"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">
            Google Tag (G- ou AW-)
          </Label>
          <input
            type="text"
            value={meta.googleTagId ?? ""}
            onChange={(e) => updateMeta({ googleTagId: e.target.value || undefined })}
            placeholder="G-XXXXXXXXXX ou AW-XXXXXXXXX"
            className="mt-1 w-full h-8 rounded border px-2 text-xs bg-background font-mono"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">
            Google Tag Manager (GTM-)
          </Label>
          <input
            type="text"
            value={meta.gtmId ?? ""}
            onChange={(e) => updateMeta({ gtmId: e.target.value || undefined })}
            placeholder="GTM-XXXXXXX"
            className="mt-1 w-full h-8 rounded border px-2 text-xs bg-background font-mono"
          />
        </div>
      </div>

      <hr className="my-4" />

      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
        UTM defaults
      </p>
      <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
        Aplicados quando o lead chega sem utm na URL. Sobrescrevidos
        pela URL quando presentes.
      </p>
      <div className="space-y-3">
        {(
          [
            ["utmSource", "utm_source", "google, facebook, ig…"],
            ["utmMedium", "utm_medium", "cpc, organic, email…"],
            ["utmCampaign", "utm_campaign", "black-friday-2026"],
            ["utmContent", "utm_content", "banner-top"],
            ["utmTerm", "utm_term", "palavra-chave"],
          ] as const
        ).map(([key, lbl, ph]) => (
          <div key={key}>
            <Label className="text-[11px] text-muted-foreground">{lbl}</Label>
            <input
              type="text"
              value={(meta[key] as string) ?? ""}
              onChange={(e) =>
                updateMeta({ [key]: e.target.value || undefined })
              }
              placeholder={ph}
              className="mt-1 w-full h-8 rounded border px-2 text-xs bg-background font-mono"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
