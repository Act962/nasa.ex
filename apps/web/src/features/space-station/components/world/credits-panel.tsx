"use client";

/**
 * CreditsPanel — Painel de atribuição de licença CC BY-SA 3.0
 *
 * Exibe os créditos obrigatórios de todos os assets de terceiros utilizados
 * no Space Station (personagens, objetos de mapa, etc.) sob licença
 * Creative Commons Attribution-ShareAlike 3.0 / 4.0.
 *
 * Conformidade com: https://creativecommons.org/licenses/by-sa/3.0/
 */

import { X, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onClose: () => void;
}

interface AssetCredit {
  title:    string;
  author:   string;
  authorUrl?: string;
  source:   string;
  sourceUrl: string;
  license:  string;
  licenseUrl: string;
  notes?:   string;
}

const CREDITS: AssetCredit[] = [
  {
    title:      "Pipoya Free RPG Character Sprites 32×32",
    author:     "Pipoya",
    authorUrl:  "https://pipoya.itch.io/",
    source:     "pipoya.itch.io",
    sourceUrl:  "https://pipoya.itch.io/pipoya-free-rpg-character-sprites-32x32",
    license:    "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    notes:      "Sprites de avatar dos jogadores. Derivados do Liberated Pixel Cup (LPC), compatível com CC BY-SA 3.0.",
  },
  {
    title:      "Liberated Pixel Cup (LPC) Character Sprites",
    author:     "Lanea Zimmermann, Stephen Challener, Charles Randall, Jonathan Webley, Jetrel, Guido Bos, Daniel Eddeland, Ray Larabie, William Thompson, Johannes Sjölund, Zi Ye e colaboradores OpenGameArt",
    authorUrl:  "https://opengameart.org/content/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles",
    source:     "opengameart.org (Liberated Pixel Cup)",
    sourceUrl:  "https://lpc.opengameart.org/",
    license:    "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    notes:      'Usados no avatar "Pixel Astronaut" e como base para spritesheets LPC. Obrigação de share-alike.',
  },
  {
    title:      "Modern Interiors — RPG Tileset",
    author:     "LimeZu",
    authorUrl:  "https://limezu.itch.io/",
    source:     "limezu.workadventu.re (espelhado via WorkAdventure)",
    sourceUrl:  "https://limezu.itch.io/moderninteriors",
    license:    "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    notes:      "Objetos de decoração do mapa (móveis, equipamentos, etc.).",
  },
  {
    title:      "WorkAdventure Woka Character Pack",
    author:     "WorkAdventure / Theodo",
    authorUrl:  "https://workadventu.re/",
    source:     "github.com/workadventure/workadventure",
    sourceUrl:  "https://github.com/workadventure/workadventure",
    license:    "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    notes:      "Formato e estrutura de spritesheet dos avatares Pipoya/LPC adaptados pelo WorkAdventure.",
  },
];

export function CreditsPanel({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-base">©</div>
            <div>
              <h2 className="text-white font-semibold text-base leading-tight">Créditos e Atribuições</h2>
              <p className="text-slate-400 text-xs mt-0.5">Creative Commons Attribution-ShareAlike</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-400 hover:text-white h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Notice */}
        <div className="mx-6 mt-4 shrink-0 flex items-start gap-3 px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <Info className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
          <p className="text-xs text-orange-200 leading-relaxed">
            Este produto utiliza assets de terceiros licenciados sob{" "}
            <a
              href="https://creativecommons.org/licenses/by-sa/3.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-orange-100"
            >
              Creative Commons Attribution-ShareAlike 3.0
            </a>{" "}
            e versões compatíveis. A atribuição abaixo é obrigatória e o trabalho derivado é
            redistribuído sob as mesmas condições de licença.
          </p>
        </div>

        {/* Credits list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {CREDITS.map((c, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-slate-800/40 p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-white text-sm font-semibold leading-snug">{c.title}</h3>
                <a
                  href={c.licenseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/25 hover:bg-orange-500/25 transition-colors"
                >
                  {c.license}
                </a>
              </div>

              <div className="space-y-1 text-xs text-slate-400">
                <div>
                  <span className="text-slate-500 mr-1">Autor:</span>
                  {c.authorUrl ? (
                    <a
                      href={c.authorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:text-sky-300 underline underline-offset-2"
                    >
                      {c.author}
                    </a>
                  ) : (
                    <span className="text-slate-300">{c.author}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 mr-1">Fonte:</span>
                  <a
                    href={c.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:text-sky-300 underline underline-offset-2 inline-flex items-center gap-1"
                  >
                    {c.source}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {c.notes && (
                  <p className="text-slate-500 italic mt-1 leading-relaxed">{c.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-800/40 shrink-0">
          <p className="text-[11px] text-slate-500 text-center">
            Para mais informações sobre as licenças CC, visite{" "}
            <a
              href="https://creativecommons.org/licenses/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-500 hover:text-sky-400 underline"
            >
              creativecommons.org/licenses
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
