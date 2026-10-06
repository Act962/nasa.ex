"use client";

/** Editores das sections "Tabela comparativa" e "Antes × Depois". */

import { Check, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ElementBase } from "../../types";
import {
  COMPARISON_CELL_NO,
  COMPARISON_CELL_YES,
  type ComparisonRow,
} from "../elements/sections/section-comparison";
import { ColorPickerWithPalette } from "./color-picker-with-palette";
import { PropertyGroup } from "./property-group";

export interface SectionEditorProps {
  el: ElementBase;
  update: (patch: Partial<ElementBase>) => void;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="text-xs"
      />
    </div>
  );
}

function SectionHeadingFields({ el, update }: SectionEditorProps) {
  return (
    <PropertyGroup title="Título da seção" defaultOpen>
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
        <Label className="text-[10px] text-muted-foreground">Texto de apoio</Label>
        <Textarea
          rows={3}
          value={(el.subheading as string) ?? ""}
          onChange={(event) => update({ subheading: event.target.value })}
          className="text-xs"
        />
      </div>
    </PropertyGroup>
  );
}

export function SectionColorsAndAnchor({ el, update }: SectionEditorProps) {
  return (
    <>
      <PropertyGroup title="Cores">
        <ColorPickerWithPalette
          label="Fundo"
          value={(el.bgColor as string) ?? ""}
          onChange={(bgColor) => update({ bgColor })}
        />
        <ColorPickerWithPalette
          label="Texto"
          value={(el.fgColor as string) ?? ""}
          onChange={(fgColor) => update({ fgColor })}
        />
        <ColorPickerWithPalette
          label="Destaque"
          value={(el.primaryColor as string) ?? ""}
          onChange={(primaryColor) => update({ primaryColor })}
        />
        <ColorPickerWithPalette
          label="Texto secundário"
          value={(el.mutedColor as string) ?? ""}
          onChange={(mutedColor) => update({ mutedColor })}
        />
      </PropertyGroup>
      <PropertyGroup title="Link do menu">
        <TextField
          label="Âncora (para o menu ou um botão apontar para cá)"
          value={(el.anchorId as string) ?? ""}
          onChange={(anchorId) => update({ anchorId: anchorId.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-") })}
          placeholder="comparativo"
        />
      </PropertyGroup>
    </>
  );
}

export function ComparisonProps({ el, update }: SectionEditorProps) {
  const columns = (el.columns as string[] | undefined) ?? [];
  const rows = (el.rows as ComparisonRow[] | undefined) ?? [];
  const highlightedColumn = (el.highlightedColumn as number | undefined) ?? -1;

  const renameColumn = (columnIndex: number, columnName: string) =>
    update({ columns: columns.map((current, index) => (index === columnIndex ? columnName : current)) });

  const addColumn = () =>
    update({
      columns: [...columns, `Opção ${columns.length + 1}`],
      rows: rows.map((row) => ({ ...row, values: [...row.values, COMPARISON_CELL_NO] })),
    });

  const removeColumn = (columnIndex: number) =>
    update({
      columns: columns.filter((_, index) => index !== columnIndex),
      rows: rows.map((row) => ({ ...row, values: row.values.filter((_, index) => index !== columnIndex) })),
      highlightedColumn:
        highlightedColumn === columnIndex
          ? -1
          : highlightedColumn > columnIndex
            ? highlightedColumn - 1
            : highlightedColumn,
    });

  const patchRow = (rowId: string, rowPatch: Partial<ComparisonRow>) =>
    update({ rows: rows.map((row) => (row.id === rowId ? { ...row, ...rowPatch } : row)) });

  const toggleCell = (row: ComparisonRow, columnIndex: number) => {
    const nextValues = columns.map((_, index) => row.values[index] ?? COMPARISON_CELL_NO);
    nextValues[columnIndex] = nextValues[columnIndex] === COMPARISON_CELL_YES ? COMPARISON_CELL_NO : COMPARISON_CELL_YES;
    patchRow(row.id, { values: nextValues });
  };

  const addRow = () =>
    update({
      rows: [
        ...rows,
        { id: `row_${Date.now()}`, label: "Novo item", values: columns.map(() => COMPARISON_CELL_NO) },
      ],
    });

  return (
    <>
      <SectionHeadingFields el={el} update={update} />

      <PropertyGroup title={`Colunas (${columns.length})`} defaultOpen>
        <TextField
          label="Título da primeira coluna"
          value={(el.featureColumnLabel as string) ?? ""}
          onChange={(featureColumnLabel) => update({ featureColumnLabel })}
          placeholder="O que está incluso"
        />
        {columns.map((columnName, columnIndex) => (
          <div key={columnIndex} className="flex items-center gap-1.5">
            <Input
              value={columnName}
              onChange={(event) => renameColumn(columnIndex, event.target.value)}
              className="text-xs"
              aria-label={`Nome da coluna ${columnIndex + 1}`}
            />
            <Button
              type="button"
              size="sm"
              variant={highlightedColumn === columnIndex ? "default" : "outline"}
              className="h-8 shrink-0 px-2 text-[10px]"
              onClick={() => update({ highlightedColumn: highlightedColumn === columnIndex ? -1 : columnIndex })}
              title="Destacar esta coluna"
            >
              Destaque
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 shrink-0"
              onClick={() => removeColumn(columnIndex)}
              aria-label={`Remover coluna ${columnName}`}
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full gap-1 text-xs" onClick={addColumn}>
          <Plus className="size-3.5" />
          Adicionar coluna
        </Button>
      </PropertyGroup>

      <PropertyGroup title={`Linhas (${rows.length})`} defaultOpen>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Toque no nome de cada coluna para marcar se o item está incluso nela.
        </p>
        {rows.map((row) => (
          <div key={row.id} className="flex flex-col gap-1.5 rounded-lg border p-2">
            <div className="flex items-center gap-1.5">
              <Input
                value={row.label}
                onChange={(event) => patchRow(row.id, { label: event.target.value })}
                className="text-xs"
                aria-label="Texto do item"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 shrink-0"
                onClick={() => update({ rows: rows.filter((current) => current.id !== row.id) })}
                aria-label={`Remover linha ${row.label}`}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {columns.map((columnName, columnIndex) => {
                const isIncluded = row.values[columnIndex] === COMPARISON_CELL_YES;
                return (
                  <button
                    key={columnIndex}
                    type="button"
                    onClick={() => toggleCell(row, columnIndex)}
                    aria-pressed={isIncluded}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors",
                      isIncluded
                        ? "border-success/40 bg-success/15 text-success"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {isIncluded ? <Check className="size-3" /> : <X className="size-3" />}
                    {columnName}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full gap-1 text-xs" onClick={addRow}>
          <Plus className="size-3.5" />
          Adicionar linha
        </Button>
      </PropertyGroup>

      <SectionColorsAndAnchor el={el} update={update} />
    </>
  );
}

function toItemLines(rawText: string): string[] {
  return rawText.split("\n");
}

function BeforeAfterColumnFields({
  groupTitle,
  eyebrow,
  title,
  items,
  onChange,
}: {
  groupTitle: string;
  eyebrow: string;
  title: string;
  items: string[];
  onChange: (columnPatch: { eyebrow?: string; title?: string; items?: string[] }) => void;
}) {
  return (
    <PropertyGroup title={groupTitle} defaultOpen>
      <TextField label="Chamada" value={eyebrow} onChange={(nextEyebrow) => onChange({ eyebrow: nextEyebrow })} />
      <TextField label="Título" value={title} onChange={(nextTitle) => onChange({ title: nextTitle })} />
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] text-muted-foreground">Itens (um por linha)</Label>
        <Textarea
          rows={6}
          value={items.join("\n")}
          onChange={(event) => onChange({ items: toItemLines(event.target.value) })}
          className="text-xs leading-relaxed"
        />
      </div>
    </PropertyGroup>
  );
}

export function BeforeAfterProps({ el, update }: SectionEditorProps) {
  return (
    <>
      <SectionHeadingFields el={el} update={update} />
      <BeforeAfterColumnFields
        groupTitle="Coluna Antes"
        eyebrow={(el.beforeEyebrow as string) ?? ""}
        title={(el.beforeTitle as string) ?? ""}
        items={(el.beforeItems as string[] | undefined) ?? []}
        onChange={(columnPatch) =>
          update({
            ...(columnPatch.eyebrow !== undefined ? { beforeEyebrow: columnPatch.eyebrow } : {}),
            ...(columnPatch.title !== undefined ? { beforeTitle: columnPatch.title } : {}),
            ...(columnPatch.items !== undefined ? { beforeItems: columnPatch.items } : {}),
          })
        }
      />
      <BeforeAfterColumnFields
        groupTitle="Coluna Depois"
        eyebrow={(el.afterEyebrow as string) ?? ""}
        title={(el.afterTitle as string) ?? ""}
        items={(el.afterItems as string[] | undefined) ?? []}
        onChange={(columnPatch) =>
          update({
            ...(columnPatch.eyebrow !== undefined ? { afterEyebrow: columnPatch.eyebrow } : {}),
            ...(columnPatch.title !== undefined ? { afterTitle: columnPatch.title } : {}),
            ...(columnPatch.items !== undefined ? { afterItems: columnPatch.items } : {}),
          })
        }
      />
      <SectionColorsAndAnchor el={el} update={update} />
    </>
  );
}
