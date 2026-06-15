import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DEFAULT_UI_COLORS } from "@/utils/whatsapp-utils";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Selecionar cor"
          className="size-5 rounded-sm cursor-pointer"
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_UI_COLORS.map((color) => {
            const isSelected = value === color;
            return (
              <button
                key={color}
                type="button"
                aria-label={`Cor ${color}`}
                className={cn(
                  "size-5 rounded-sm cursor-pointer hover:scale-110 transition-transform",
                  isSelected && "ring-1 ring-offset-1 ring-primary",
                )}
                style={{ backgroundColor: color }}
                onClick={() => onChange(color)}
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
