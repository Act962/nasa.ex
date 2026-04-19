import { useCallback, useRef } from "react";
import { RichtTextEditor } from "@/components/rich-text-editor/editor";

interface DescriptionProps {
  description?: string | null;
  onDescriptionChange: (value: string) => void;
}

export function ActionDescription({
  description,
  onDescriptionChange,
}: DescriptionProps) {
  const descriptionSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleChange = useCallback(
    (value: string) => {
      if (descriptionSaveTimerRef.current) {
        clearTimeout(descriptionSaveTimerRef.current);
      }
      descriptionSaveTimerRef.current = setTimeout(() => {
        onDescriptionChange(value);
      }, 800);
    },
    [onDescriptionChange],
  );

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Descrição
      </p>
      <RichtTextEditor
        field={description ?? undefined}
        onChange={handleChange}
        placeholder="Digite a descrição da ação"
      />
    </div>
  );
}
