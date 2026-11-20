"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Check, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  PAYMENT_METHOD_OPTIONS,
  PROPOSAL_SECTIONS,
  PROPOSAL_TEMPLATES,
  type ProposalPaymentMethod,
  type ProposalPaymentMethodId,
  type ProposalSectionSetting,
  type ProposalTemplateId,
} from "@/features/forge/lib/proposal-look";

export function TemplatePicker({ value, onChange }: { value: ProposalTemplateId; onChange: (template: ProposalTemplateId) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {PROPOSAL_TEMPLATES.map((template) => {
        const isSelected = template.id === value;
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onChange(template.id)}
            className={cn(
              "rounded-xl border p-3 text-left transition-colors",
              isSelected ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
            )}
          >
            <span className="flex items-center justify-between gap-2 text-sm font-semibold">
              {template.name}
              {isSelected ? <Check className="size-4 text-primary" /> : null}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">{template.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (color: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-11 cursor-pointer rounded border p-0.5" />
        <Input value={value} onChange={(event) => onChange(event.target.value)} className="flex-1 font-mono text-xs" maxLength={7} />
      </span>
      <span className="block text-[11px] text-muted-foreground">{hint}</span>
    </label>
  );
}

const SECTION_LABELS = Object.fromEntries(PROPOSAL_SECTIONS.map((section) => [section.id, section.label]));

function SortableSectionRow({
  section,
  index,
  total,
  onToggle,
  onMove,
}: {
  section: ProposalSectionSetting;
  index: number;
  total: number;
  onToggle: (enabled: boolean) => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5", isDragging && "z-10 shadow-lg")}
    >
      <button type="button" aria-label="Arrastar" className="touch-none cursor-grab p-1 text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <span className={cn("flex-1 text-sm", !section.enabled && "text-muted-foreground line-through")}>{SECTION_LABELS[section.id]}</span>
      <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => onMove(-1)} className="p-1 text-muted-foreground disabled:opacity-30">
        <ArrowUp className="size-4" />
      </button>
      <button type="button" aria-label="Descer" disabled={index === total - 1} onClick={() => onMove(1)} className="p-1 text-muted-foreground disabled:opacity-30">
        <ArrowDown className="size-4" />
      </button>
      <Switch checked={section.enabled} onCheckedChange={onToggle} aria-label={`Mostrar ${SECTION_LABELS[section.id]}`} />
    </li>
  );
}

/** Ordem e visibilidade das seções: arrastar no computador, setas no celular (spec 0150, RF-3). */
export function SectionsEditor({ sections, onChange }: { sections: ProposalSectionSetting[]; onChange: (sections: ProposalSectionSetting[]) => void }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((section) => section.id === active.id);
    const to = sections.findIndex((section) => section.id === over.id);
    if (from >= 0 && to >= 0) onChange(arrayMove(sections, from, to));
  };
  const toggle = (index: number, enabled: boolean) => {
    const next = sections.map((section, position) => (position === index ? { ...section, enabled } : section));
    const items = next.find((section) => section.id === "items");
    const totals = next.find((section) => section.id === "totals");
    // Itens e totais não somem juntos: a proposta ficaria sem valor nenhum.
    if (items && totals && !items.enabled && !totals.enabled) return;
    onChange(next);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1.5">
          {sections.map((section, index) => (
            <SortableSectionRow
              key={section.id}
              section={section}
              index={index}
              total={sections.length}
              onToggle={(enabled) => toggle(index, enabled)}
              onMove={(direction) => onChange(arrayMove(sections, index, index + direction))}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

export function PaymentMethodsEditor({ value, onChange }: { value: ProposalPaymentMethod[]; onChange: (methods: ProposalPaymentMethod[]) => void }) {
  const byMethod = new Map(value.map((entry) => [entry.method, entry]));
  const update = (method: ProposalPaymentMethodId, patch: Partial<ProposalPaymentMethod> | null) => {
    if (patch === null) return onChange(value.filter((entry) => entry.method !== method));
    const current = byMethod.get(method);
    const next = { method, ...current, ...patch };
    // Mantém a ordem da lista de opções, que é a ordem em que aparecem na proposta.
    onChange(
      PAYMENT_METHOD_OPTIONS.map((option) => (option.method === method ? next : byMethod.get(option.method))).filter(
        (entry): entry is ProposalPaymentMethod => Boolean(entry),
      ),
    );
  };
  return (
    <div className="space-y-2">
      {PAYMENT_METHOD_OPTIONS.map((option) => {
        const entry = byMethod.get(option.method);
        return (
          <div key={option.method} className="rounded-lg border px-3 py-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={Boolean(entry)} onCheckedChange={(checked) => update(option.method, checked ? {} : null)} />
              {option.label}
            </label>
            {entry ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-[7rem_1fr]">
                {option.method === "CREDITO" ? (
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    placeholder="Até x vezes"
                    value={entry.installments ?? ""}
                    onChange={(event) => update(option.method, { installments: event.target.value ? Number(event.target.value) : null })}
                  />
                ) : null}
                <Input
                  className={option.method === "CREDITO" ? "" : "sm:col-span-2"}
                  placeholder={option.hint || "Observação (opcional)"}
                  maxLength={120}
                  value={entry.note ?? ""}
                  onChange={(event) => update(option.method, { note: event.target.value })}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
