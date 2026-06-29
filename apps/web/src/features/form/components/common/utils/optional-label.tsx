import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label que se esconde quando vazia. Usado nos child blocks pra que campos
 * sem título não exibam um espaço em branco no builder ou no submit-form.
 *
 * Trata `null`, `undefined`, string vazia e só-whitespace como "vazio".
 */
export function OptionalLabel({
  label,
  required,
  className,
  isError,
  style,
}: {
  label: string | null | undefined;
  required?: boolean;
  className?: string;
  isError?: boolean;
  style?: React.CSSProperties;
}) {
  if (!label || !label.trim()) return null;
  return (
    <Label
      className={cn(
        "text-base font-normal! mb-2",
        isError && "text-red-500",
        className,
      )}
      style={style}
    >
      {label}
      {required && <span className="text-red-500"> *</span>}
    </Label>
  );
}
