/**
 * page-settings-panel — conteúdo da aba "Ajustes" da sidebar.
 *
 * Configurações da página inteira — aparência básica (background,
 * height) + paleta de cores reusável + tracking (Meta Pixel, Google
 * Analytics/Tag, GTM, UTM defaults).
 *
 * UTM defaults: usados quando alguém chega na page SEM utm na URL.
 * O lead criado herda esses valores. Útil pra campanhas externas
 * que esquecem de adicionar UTM.
 *
 * Tracking IDs (Meta Pixel, GA, GTM) ficam no `layout.meta` — sem
 * migration. O public renderer injeta os scripts no client.
 *
 * O bloco "Padrão de cores" é delegado ao `PalettePanel`.
 */
"use client";

import { Label } from "@/components/ui/label";
import { usePagesBuilderStore } from "../../context/pages-builder-store";
import { ColorPickerWithPalette } from "../properties-panel/color-picker-with-palette";
import { UrlSlugEditor } from "./url-slug-editor";
import { PalettePanel } from "./palette-panel";
import { ChatLeadDestinationFields } from "./chat-lead-destination-fields";

export function PageSettingsPanel({
  bgColor,
  updateArtboard,
  layout,
}: {
  bgColor: string;
  updateArtboard: (
    p: Partial<{ background: string; minHeight: number }>,
  ) => void;
  layout: ReturnType<typeof usePagesBuilderStore.getState>["layout"];
}) {
  const updateMeta = usePagesBuilderStore((s) => s.updateMeta);
  const updatePalette = usePagesBuilderStore((s) => s.updatePalette);
  const meta = ((layout as unknown as { meta?: Record<string, unknown> })
    ?.meta ?? {}) as Record<string, string | undefined>;
  const palette = ((layout as unknown as { palette?: Record<string, string> })
    ?.palette ?? {}) as Record<string, string>;

  return (
    <div>
      <UrlSlugEditor />
      <div className="py-2 px-3">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-3">
          Aparência da página
        </p>
        <div className="space-y-4">
          <ColorPickerWithPalette
            label="Cor de fundo"
            value={bgColor}
            onChange={(hex) => {
              // Grava nos DOIS canais: artboard.background (layout) e
              // palette.bg (coluna via write-through). Mantém sincronizados
              // pra que a página pública — que lê palette.bg primeiro —
              // reflita a cor escolhida.
              updateArtboard({ background: hex });
              updatePalette({ bg: hex });
            }}
          />
          <div>
            <Label className="text-[11px] text-muted-foreground">
              Altura mínima (px)
            </Label>
            <input
              type="number"
              min={400}
              step={100}
              value={layout?.artboard.minHeight ?? 800}
              onChange={(e) =>
                updateArtboard({ minHeight: Number(e.target.value) })
              }
              className="mt-1 w-full h-8 rounded border px-2 text-xs bg-background"
            />
          </div>
        </div>

        <hr className="my-4" />

        {/* Padrão de cores da página — vira swatches reusáveis em todos os
          color pickers via ColorPickerWithPalette. Editor inline com
          input nome + cor + botão remover, e botão "+ Adicionar cor"
          no fim. */}
        <PalettePanel palette={palette} updatePalette={updatePalette} />

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
            <Label className="text-[11px] text-muted-foreground">
              Meta Pixel ID
            </Label>
            <input
              type="text"
              value={meta.metaPixelId ?? ""}
              onChange={(e) =>
                updateMeta({ metaPixelId: e.target.value || undefined })
              }
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
              onChange={(e) =>
                updateMeta({ googleTagId: e.target.value || undefined })
              }
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
              onChange={(e) =>
                updateMeta({ gtmId: e.target.value || undefined })
              }
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
          Aplicados quando o lead chega sem utm na URL. Sobrescrevidos pela URL
          quando presentes.
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

        <hr className="my-4" />

        <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
          Destino do lead (Chat)
        </p>
        <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
          Funil e status onde cai o lead que se identifica pelo botão de chat
          desta página. Vazio = primeiro status do funil padrão.
        </p>
        <ChatLeadDestinationFields
          trackingId={meta.inChatTrackingId}
          statusId={meta.inChatStatusId}
          updateMeta={updateMeta}
        />
      </div>
    </div>
  );
}
