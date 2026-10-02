import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReleaseTextField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
      />
    </div>
  );
}

/** Uma linha por item — mais simples de editar que chips e vira array direto. */
export function ReleaseListField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        <span className="ml-1.5 font-normal text-muted-foreground">
          um por linha
        </span>
      </Label>
      <Textarea
        value={values.join("\n")}
        onChange={(event) =>
          onChange(
            event.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
          )
        }
        rows={Math.max(2, Math.min(values.length + 1, 8))}
      />
    </div>
  );
}
