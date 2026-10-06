"use client";

/** Editores do bloco "Foto + texto" e dos "Botões flutuantes". */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ElementBase } from "../../types";
import { buildWhatsAppUrl } from "../elements/floating-buttons";
import { ColorPickerWithPalette } from "./color-picker-with-palette";
import { SectionColorsAndAnchor, TextField, type SectionEditorProps } from "./comparison-props";
import { ImageUploaderField } from "./image-uploader-field";
import { PropertyGroup } from "./property-group";

function LinesField({
  label,
  hint,
  lines,
  onChange,
  rows = 5,
}: {
  label: string;
  hint?: string;
  lines: string[];
  onChange: (nextLines: string[]) => void;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Textarea
        rows={rows}
        value={lines.join("\n")}
        onChange={(event) => onChange(event.target.value.split("\n"))}
        className="text-xs leading-relaxed"
      />
      {hint && <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SwitchRow({
  label,
  description,
  isChecked,
  onChange,
}: {
  label: string;
  description?: string;
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium">{label}</span>
        {description && <span className="text-[10px] leading-snug text-muted-foreground">{description}</span>}
      </span>
      <Switch checked={isChecked} onCheckedChange={onChange} className="shrink-0" />
    </label>
  );
}

function SideToggle({
  activeSide,
  onChange,
}: {
  activeSide: "left" | "right";
  onChange: (side: "left" | "right") => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-full bg-muted p-0.5">
      {(["left", "right"] as const).map((side) => (
        <button
          key={side}
          type="button"
          onClick={() => onChange(side)}
          aria-pressed={activeSide === side}
          className={cn(
            "h-7 flex-1 rounded-full text-xs font-medium transition-colors",
            activeSide === side ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {side === "left" ? "Esquerda" : "Direita"}
        </button>
      ))}
    </div>
  );
}

export function MediaTextProps({ el, update }: SectionEditorProps) {
  return (
    <>
      <PropertyGroup title="Foto" defaultOpen>
        <ImageUploaderField
          value={(el.imageUrl as string) ?? ""}
          onChange={(imageUrl) => update({ imageUrl })}
          previewHeight={120}
        />
        <TextField
          label="Descrição da foto (acessibilidade)"
          value={(el.imageAlt as string) ?? ""}
          onChange={(imageAlt) => update({ imageAlt })}
        />
        <Label className="text-[10px] text-muted-foreground">Lado da foto (no computador)</Label>
        <SideToggle
          activeSide={(el.imageSide as string) === "left" ? "left" : "right"}
          onChange={(imageSide) => update({ imageSide })}
        />
      </PropertyGroup>

      <PropertyGroup title="Texto" defaultOpen>
        <TextField
          label="Chamada (acima do título)"
          value={(el.eyebrow as string) ?? ""}
          onChange={(eyebrow) => update({ eyebrow })}
        />
        <TextField label="Título" value={(el.heading as string) ?? ""} onChange={(heading) => update({ heading })} />
        <p className="text-[10px] leading-snug text-muted-foreground">
          Coloque um trecho entre *asteriscos* para destacá-lo.
        </p>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground">Parágrafos (um por linha)</Label>
          <Textarea
            rows={6}
            value={(el.body as string) ?? ""}
            onChange={(event) => update({ body: event.target.value })}
            className="text-xs leading-relaxed"
          />
        </div>
        <SwitchRow
          label="Usar como topo da página"
          description="Título maior, para abrir o site com a foto ao lado."
          isChecked={(el.isHero as boolean | undefined) ?? false}
          onChange={(isHero) => update({ isHero })}
        />
      </PropertyGroup>

      <PropertyGroup title="Lista com ✓">
        <LinesField
          label="Itens (um por linha)"
          lines={(el.checklist as string[] | undefined) ?? []}
          onChange={(checklist) => update({ checklist })}
        />
      </PropertyGroup>

      <PropertyGroup title="Botões">
        <TextField
          label="Botão principal"
          value={(el.primaryButtonLabel as string) ?? ""}
          onChange={(primaryButtonLabel) => update({ primaryButtonLabel })}
          placeholder="Quero participar"
        />
        <TextField
          label="Link do botão principal"
          value={(el.primaryButtonHref as string) ?? ""}
          onChange={(primaryButtonHref) => update({ primaryButtonHref })}
          placeholder="#planos ou https://…"
        />
        <TextField
          label="Botão secundário (opcional)"
          value={(el.secondaryButtonLabel as string) ?? ""}
          onChange={(secondaryButtonLabel) => update({ secondaryButtonLabel })}
        />
        <TextField
          label="Link do botão secundário"
          value={(el.secondaryButtonHref as string) ?? ""}
          onChange={(secondaryButtonHref) => update({ secondaryButtonHref })}
          placeholder="#planos ou https://…"
        />
      </PropertyGroup>

      <PropertyGroup title="Números">
        <LinesField
          label="Um por linha, no formato: valor | legenda"
          hint="Exemplo: 500+ | Alunas formadas"
          rows={4}
          lines={(el.stats as string[] | undefined) ?? []}
          onChange={(stats) => update({ stats })}
        />
      </PropertyGroup>

      <SectionColorsAndAnchor el={el} update={update} />
    </>
  );
}

export function FloatingButtonsProps({ el, update }: SectionEditorProps) {
  const whatsappPhone = (el.whatsappPhone as string) ?? "";
  const whatsappMessage = (el.whatsappMessage as string) ?? "";
  const isWhatsAppEnabled = (el.whatsappEnabled as boolean | undefined) ?? true;
  const hasValidPhone = buildWhatsAppUrl(whatsappPhone, whatsappMessage) !== null;

  return (
    <>
      <PropertyGroup title="WhatsApp" defaultOpen>
        <SwitchRow
          label="Mostrar botão do WhatsApp"
          isChecked={isWhatsAppEnabled}
          onChange={(whatsappEnabled) => update({ whatsappEnabled })}
        />
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground">Número com DDD</Label>
          <Input
            value={whatsappPhone}
            onChange={(event) => update({ whatsappPhone: event.target.value })}
            placeholder="(92) 99999-9999"
            inputMode="tel"
            className="text-xs"
          />
          {isWhatsAppEnabled && !hasValidPhone && (
            <p className="text-[10px] leading-snug text-warning">
              Sem um número com DDD o botão do WhatsApp não aparece no site.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground">Mensagem que já vem escrita</Label>
          <Textarea
            rows={3}
            value={whatsappMessage}
            onChange={(event) => update({ whatsappMessage: event.target.value })}
            className="text-xs"
          />
        </div>
      </PropertyGroup>

      <PropertyGroup title="Voltar ao topo" defaultOpen>
        <SwitchRow
          label="Mostrar botão de voltar ao topo"
          description="Aparece depois que a pessoa rola a página."
          isChecked={(el.backToTopEnabled as boolean | undefined) ?? true}
          onChange={(backToTopEnabled) => update({ backToTopEnabled })}
        />
        <ColorPickerWithPalette
          label="Cor do botão"
          value={(el.bgColor as string) ?? ""}
          onChange={(bgColor) => update({ bgColor })}
        />
        <ColorPickerWithPalette
          label="Cor da seta"
          value={(el.fgColor as string) ?? ""}
          onChange={(fgColor) => update({ fgColor })}
        />
      </PropertyGroup>

      <PropertyGroup title="Posição" defaultOpen>
        <Label className="text-[10px] text-muted-foreground">Canto da tela</Label>
        <SideToggle
          activeSide={(el.side as string) === "left" ? "left" : "right"}
          onChange={(side) => update({ side })}
        />
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground">Distância da base da tela (px)</Label>
          <Input
            type="number"
            min={0}
            max={400}
            value={(el.bottomOffset as number | undefined) ?? 20}
            onChange={(event) => update({ bottomOffset: Number(event.target.value) })}
            className="text-xs"
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            Se a página também tem o Chat IA no mesmo canto, aumente este valor ou troque o lado.
          </p>
        </div>
      </PropertyGroup>
    </>
  );
}

export function SectionEffectsFields({ el, update }: { el: ElementBase; update: (patch: Partial<ElementBase>) => void }) {
  const isCascadeEnabled = (el.cascadeReveal as boolean | undefined) ?? false;
  return (
    <>
      <SwitchRow
        label="Entrada em cascata"
        description="Título, cards e botões do bloco surgem um depois do outro quando ele aparece na tela."
        isChecked={isCascadeEnabled}
        onChange={(cascadeReveal) => update({ cascadeReveal })}
      />
      {isCascadeEnabled && (
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">Intervalo (ms)</Label>
            <Input
              type="number"
              min={0}
              max={1000}
              step={20}
              value={(el.cascadeStepMs as number | undefined) ?? 120}
              onChange={(event) => update({ cascadeStepMs: Number(event.target.value) })}
              className="text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">Duração (ms)</Label>
            <Input
              type="number"
              min={100}
              max={3000}
              step={50}
              value={(el.cascadeDurationMs as number | undefined) ?? 600}
              onChange={(event) => update({ cascadeDurationMs: Number(event.target.value) })}
              className="text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">Distância (px)</Label>
            <Input
              type="number"
              min={0}
              max={200}
              step={4}
              value={(el.cascadeDistance as number | undefined) ?? 24}
              onChange={(event) => update({ cascadeDistance: Number(event.target.value) })}
              className="text-xs"
            />
          </div>
        </div>
      )}
    </>
  );
}

export function TitleHighlightFields({ el, update }: { el: ElementBase; update: (patch: Partial<ElementBase>) => void }) {
  return (
    <>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        No título, escreva o trecho entre *asteriscos* para destacá-lo. Exemplo: Invista na sua *carreira*.
      </p>
      <SwitchRow
        label="Destaque em itálico"
        isChecked={(el.highlightItalic as boolean | undefined) ?? true}
        onChange={(highlightItalic) => update({ highlightItalic })}
      />
      <ColorPickerWithPalette
        label="Cor do destaque (vazio = cor de destaque do bloco)"
        value={(el.highlightColor as string) ?? ""}
        onChange={(highlightColor) => update({ highlightColor })}
      />
    </>
  );
}
