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
import { usePagesBuilderStore } from "../../context/pages-builder-store";
import { createElement } from "../../lib/element-factory";
import type { ElementType } from "../../types";
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

export function BuilderSidebar() {
  const [tab, setTab] = useState<Tab>("elements");
  const addElement = usePagesBuilderStore((s) => s.addElement);
  const updateArtboard = usePagesBuilderStore((s) => s.updateArtboard);
  const layout = usePagesBuilderStore((s) => s.layout);
  const selected = usePagesBuilderStore((s) => s.selected);

  const handleAdd = (t: ElementType) => {
    addElement(createElement(t, {}));
  };

  const handleBlock = (block: (typeof BLOCKS)[number]) => {
    const { nanoid } = require("nanoid");
    block.elements().forEach((el) => {
      addElement({ ...el, id: `el_${nanoid(10)}` } as never);
    });
  };

  const bgColor = layout?.artboard.background ?? "#ffffff";

  return (
    <aside className="w-[300px] border-r bg-card flex flex-col shrink-0 overflow-hidden">
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
                const Icon = ICONS[t];
                return (
                  <button
                    key={t}
                    onClick={() => handleAdd(t)}
                    className="flex items-center gap-3 px-2 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span>{LABELS[t]}</span>
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
          <div className="py-2 px-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-3">Configurações da página</p>
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
          </div>
        )}

        {/* ─── Properties panel embutido ─────────────────────────────── */}
        {selected.length > 0 && (
          <PropertiesPanelContent />
        )}
      </div>
    </aside>
  );
}
