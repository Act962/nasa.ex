"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Grid3x3, Plus, Trash2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  HandleBlurFunc,
  ObjectBlockType,
} from "@/features/form/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { v4 as uuidv4 } from "uuid";
import { usePrefillFieldValue } from "@/features/form/context/form-prefill-context";
import { FormSettings } from "@/generated/prisma/client";
import { getContrastColor } from "@/utils/get-contrast-color";

/**
 * Radio Matrix — uma TABELA de radios. Cada LINHA é um item (ex: "Acessórios",
 * "Pneus", "Freios") e cada COLUNA é um status (ex: "OK", "Não OK", "Atenção").
 * Pra cada linha, o usuário escolhe UMA das colunas.
 *
 * Uso típico (Bosch case): checklist de inspeção de oficina, ficha de
 * diagnóstico, vistoria de entrega, etc.
 *
 * Persistência (`jsonResponse`):
 *   value: "Acessórios:OK,Pneus:Não OK"           (CSV human-readable)
 *   meta: {
 *     answers: { "row-1": "col-1", "row-2": "col-2" },
 *     rows: [{ id, label }],
 *     columns: [{ id, label, color? }]
 *   }
 *
 * Cores por coluna (opcional): suportam personalização visual estilo
 * "verde/amarelo/vermelho" pra reforço semântico em checklists.
 */

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "RadioMatrix";

type Row = { id: string; label: string };
type Column = { id: string; label: string; color?: string };

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  rows: Row[];
  columns: Column[];
};

const propertiesValidateSchema = z.object({
  label: z.string().trim().max(255).optional(),
  helperText: z.string().trim().max(255).optional(),
  required: z.boolean().default(false).optional(),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

export const RadioMatrixBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      label: "Checklist",
      helperText: "",
      required: false,
      rows: [
        { id: `row-${uuidv4()}`, label: "Acessórios" },
        { id: `row-${uuidv4()}`, label: "Pneus" },
        { id: `row-${uuidv4()}`, label: "Freios" },
      ],
      columns: [
        { id: `col-${uuidv4()}`, label: "OK", color: "#10b981" },
        { id: `col-${uuidv4()}`, label: "Não OK", color: "#ef4444" },
        { id: `col-${uuidv4()}`, label: "Atenção", color: "#f59e0b" },
      ],
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: Grid3x3, label: "Matriz de radios" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

type Instance = FormBlockInstance & { attributes: AttributesType };

// ─── Canvas (Builder preview, no interaction) ───────────────────────────
function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const block = blockInstance as Instance;
  const { label, helperText, required, rows, columns } = block.attributes;
  return (
    <div className="flex flex-col gap-2 w-full pointer-events-none">
      {label?.trim() && (
        <Label className="text-base font-normal! mb-2 whitespace-normal break-words leading-snug">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <MatrixTable rows={rows} columns={columns} answers={{}} disabled />
      {helperText && (
        <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">
          {helperText}
        </p>
      )}
    </div>
  );
}

// ─── FormView (público + edit) ──────────────────────────────────────────
function FormView({
  blockInstance,
  handleBlur,
  isError: isSubmitError,
  errorMessage,
  settings,
}: {
  blockInstance: FormBlockInstance;
  handleBlur?: HandleBlurFunc;
  isError?: boolean;
  errorMessage?: string;
  settings?: FormSettings | null;
}) {
  const block = blockInstance as Instance;
  const { label, helperText, required, rows, columns } = block.attributes;

  // Cor do texto = contraste do fundo do form (preto em fundo claro,
  // branco em fundo escuro). Mesmo padrão do DatePicker — sobrepõe a
  // herança do `color: textColor` que o form wrapper espalha.
  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;

  // Prefill: extrai `meta.answers` (mapa rowId → columnId).
  const prefill = usePrefillFieldValue(block.id);
  const initialAnswers: Record<string, string> = (() => {
    if (!prefill) return {};
    const metaAnswers = (prefill.meta as { answers?: unknown } | undefined)
      ?.answers;
    if (metaAnswers && typeof metaAnswers === "object") {
      const out: Record<string, string> = {};
      for (const [rowId, colId] of Object.entries(metaAnswers)) {
        if (typeof colId === "string") out[rowId] = colId;
      }
      return out;
    }
    return {};
  })();

  const [answers, setAnswers] =
    useState<Record<string, string>>(initialAnswers);
  const [isError, setIsError] = useState(false);

  // Sincroniza prefill com formVals no mount (mesmo padrão dos outros blocos).
  useEffect(() => {
    if (Object.keys(initialAnswers).length > 0 && handleBlur) {
      commitToFormVals(initialAnswers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commitToFormVals(next: Record<string, string>) {
    const summary = rows
      .filter((r) => next[r.id])
      .map((r) => {
        const col = columns.find((c) => c.id === next[r.id]);
        return `${r.label}: ${col?.label ?? ""}`;
      })
      .join(", ");
    handleBlur?.(block.id, {
      value: summary,
      meta: { answers: next, rows, columns },
    });
  }

  function pick(rowId: string, colId: string) {
    const next = { ...answers, [rowId]: colId };
    setAnswers(next);
    commitToFormVals(next);
    // Considera completo só quando todas as linhas têm uma escolha
    const allAnswered = rows.every((r) => next[r.id]);
    setIsError(required ? !allAnswered : false);
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (
        <Label
          className={`text-base font-normal! mb-2 whitespace-normal break-words leading-snug ${
            isError || isSubmitError ? "text-red-500" : ""
          }`}
        >
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <MatrixTable
        rows={rows}
        columns={columns}
        answers={answers}
        onPick={pick}
        textColor={textColor}
      />
      {helperText && (
        <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">
          {helperText}
        </p>
      )}
      {(isError || isSubmitError) && (
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">
          {errorMessage || "Marque uma opção em cada linha."}
        </p>
      )}
    </div>
  );
}

// ─── Tabela compartilhada (canvas + form view) ──────────────────────────
function MatrixTable({
  rows,
  columns,
  answers,
  onPick,
  disabled,
  textColor,
}: {
  rows: Row[];
  columns: Column[];
  answers: Record<string, string>;
  onPick?: (rowId: string, colId: string) => void;
  disabled?: boolean;
  textColor?: string;
}) {
  // Header (rótulos das colunas): usa a `col.color` se houver, senão cai
  // pra `textColor` do form. Garante que mesmo em fundos claros/escuros,
  // os labels tenham contraste — não só os definidos com cor própria.
  return (
    <div
      className="w-full overflow-x-auto rounded-md border"
      style={{
        borderColor: textColor ? `${textColor}26` : undefined,
      }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr
            className="border-b"
            style={{
              borderColor: textColor ? `${textColor}26` : undefined,
            }}
          >
            <th className="text-left px-3 py-2 font-medium" />
            {columns.map((col) => (
              <th
                key={col.id}
                className="px-3 py-2 text-center font-medium whitespace-nowrap"
                style={{
                  // Cor da coluna sobrepõe textColor; sem cor, herda
                  // textColor do form.
                  color: col.color || textColor || undefined,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr
              key={row.id}
              className={rIdx < rows.length - 1 ? "border-b" : ""}
              style={{
                borderColor:
                  rIdx < rows.length - 1 && textColor
                    ? `${textColor}26`
                    : undefined,
              }}
            >
              <td
                className="px-3 py-2 break-words"
                style={{ color: textColor || undefined }}
              >
                {row.label || (
                  <em
                    style={{
                      color: textColor ? `${textColor}99` : undefined,
                      opacity: 0.6,
                    }}
                  >
                    —
                  </em>
                )}
              </td>
              {columns.map((col) => {
                const checked = answers[row.id] === col.id;
                return (
                  <td key={col.id} className="px-3 py-2 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onPick?.(row.id, col.id)}
                      aria-label={`${row.label} = ${col.label}`}
                      className={`inline-flex items-center justify-center size-5 rounded-full border-2 transition-colors ${
                        disabled ? "cursor-default" : "cursor-pointer"
                      }`}
                      style={{
                        borderColor: checked
                          ? col.color || "var(--primary, #1447e6)"
                          : textColor
                            ? `${textColor}40` // contraste 25% c/ textColor
                            : "rgb(0 0 0 / 0.2)",
                        background: checked
                          ? col.color || "var(--primary, #1447e6)"
                          : "transparent",
                      }}
                    >
                      {checked && (
                        <span className="size-2 rounded-full bg-white" />
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Properties (sidebar do builder) ────────────────────────────────────
function PropertiesView({
  positionIndex,
  parentId,
  blockInstance,
}: {
  positionIndex?: number;
  parentId?: string;
  blockInstance: FormBlockInstance;
}) {
  const block = blockInstance as Instance;
  const { updateChildBlock } = useBuilderStore();
  const form = useForm<PropertiesType>({
    resolver: zodResolver(propertiesValidateSchema),
    mode: "onBlur",
    defaultValues: {
      label: block.attributes.label,
      helperText: block.attributes.helperText,
      required: block.attributes.required,
    },
  });

  useEffect(
    () =>
      form.reset({
        label: block.attributes.label,
        helperText: block.attributes.helperText,
        required: block.attributes.required,
      }),
    [block.attributes, form],
  );

  function commit(partial: Partial<AttributesType>) {
    if (!parentId) return;
    updateChildBlock(parentId, block.id, {
      ...block,
      attributes: { ...block.attributes, ...partial },
    });
  }

  // ── Rows CRUD ─────────────────────────────────────
  function addRow() {
    commit({
      rows: [
        ...block.attributes.rows,
        { id: `row-${uuidv4()}`, label: `Item ${block.attributes.rows.length + 1}` },
      ],
    });
  }
  function updateRow(idx: number, partial: Partial<Row>) {
    const next = block.attributes.rows.map((r, i) =>
      i === idx ? { ...r, ...partial } : r,
    );
    commit({ rows: next });
  }
  function removeRow(idx: number) {
    if (block.attributes.rows.length <= 1) return;
    const next = block.attributes.rows.filter((_, i) => i !== idx);
    commit({ rows: next });
  }

  // ── Columns CRUD ──────────────────────────────────
  function addColumn() {
    commit({
      columns: [
        ...block.attributes.columns,
        {
          id: `col-${uuidv4()}`,
          label: `Status ${block.attributes.columns.length + 1}`,
        },
      ],
    });
  }
  function updateColumn(idx: number, partial: Partial<Column>) {
    const next = block.attributes.columns.map((c, i) =>
      i === idx ? { ...c, ...partial } : c,
    );
    commit({ columns: next });
  }
  function removeColumn(idx: number) {
    if (block.attributes.columns.length <= 1) return;
    const next = block.attributes.columns.filter((_, i) => i !== idx);
    commit({ columns: next });
  }

  return (
    <div className="w-full pb-4">
      <div className="w-full flex flex-row items-center justify-between gap-1 bg-foreground/10 rounded-md h-auto p-1 px-2 mb-[10px]">
        <span className="text-sm font-medium text-muted-foreground tracking-wider">
          Matriz {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>
      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="w-full space-y-3 px-4"
        >
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">Título</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      commit({ label: e.target.value });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="helperText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">Nota</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      commit({ helperText: e.target.value });
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="required"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Obrigatório
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={!!field.value}
                      onCheckedChange={(v) => {
                        field.onChange(v);
                        commit({ required: v });
                      }}
                    />
                  </FormControl>
                </div>
              </FormItem>
            )}
          />
        </form>
      </Form>

      {/* Linhas (itens do checklist) */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium">Linhas (itens)</span>
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            <Plus className="w-3.5 h-3.5" />
            Linha
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          {block.attributes.rows.map((row, idx) => (
            <div key={row.id} className="flex items-center gap-2">
              <Input
                value={row.label}
                onChange={(e) => updateRow(idx, { label: e.target.value })}
                placeholder="Nome do item"
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => removeRow(idx)}
                disabled={block.attributes.rows.length <= 1}
                title="Remover linha"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Colunas (status disponíveis) */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium">Colunas (status)</span>
          <Button type="button" size="sm" variant="outline" onClick={addColumn}>
            <Plus className="w-3.5 h-3.5" />
            Coluna
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          {block.attributes.columns.map((col, idx) => (
            <div key={col.id} className="flex items-center gap-2">
              {/* Color picker compacto */}
              <input
                type="color"
                value={col.color ?? "#888888"}
                onChange={(e) => updateColumn(idx, { color: e.target.value })}
                className="size-7 rounded border cursor-pointer"
                title="Cor da coluna"
              />
              <Input
                value={col.label}
                onChange={(e) => updateColumn(idx, { label: e.target.value })}
                placeholder="Rótulo"
                className="h-8 text-xs flex-1"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => removeColumn(idx)}
                disabled={block.attributes.columns.length <= 1}
                title="Remover coluna"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
