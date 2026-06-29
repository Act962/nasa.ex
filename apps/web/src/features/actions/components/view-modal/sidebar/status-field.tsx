import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarField } from "./sidebar-field";

interface StatusFieldProps {
  value: string;
  columns: any[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function StatusField({
  value,
  columns,
  onValueChange,
  disabled,
}: StatusFieldProps) {
  const currentColumn = columns.find((c) => c.id === value);

  return (
    <SidebarField label="Status">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="h-8 text-xs bg-background w-full">
          <SelectValue placeholder="Sem coluna">
            {currentColumn && (
              <div className="flex items-center gap-2">
                <div
                  className="size-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: currentColumn.color ?? "#1447e6",
                  }}
                />
                <span>{currentColumn.name}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {columns.map((col) => (
            <SelectItem key={col.id} value={col.id}>
              <div className="flex items-center gap-2">
                <div
                  className="size-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: col.color ?? "#1447e6",
                  }}
                />
                {col.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SidebarField>
  );
}
