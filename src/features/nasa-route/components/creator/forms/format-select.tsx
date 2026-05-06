"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FORMAT_META, type CourseFormat } from "@/features/nasa-route/lib/formats";

interface Props {
  value: CourseFormat;
  onChange: (format: CourseFormat) => void;
  disabled?: boolean;
}

const GROUPS: { label: string; formats: CourseFormat[] }[] = [
  { label: "Cursos em vídeo", formats: ["course", "training", "mentoring"] },
  { label: "Outros formatos", formats: ["ebook", "event", "community", "subscription"] },
];

export function FormatSelect({ value, onChange, disabled }: Props) {
  const meta = FORMAT_META[value];

  return (
    <div className="space-y-2">
      <Label htmlFor="format">Formato do produto</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as CourseFormat)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GROUPS.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.formats.map((f) => {
                const m = FORMAT_META[f];
                return (
                  <SelectItem key={f} value={f}>
                    <span className="mr-2">{m.icon}</span>
                    {m.label}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{meta.description}</p>
    </div>
  );
}
