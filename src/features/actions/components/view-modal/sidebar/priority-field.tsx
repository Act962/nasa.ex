import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarField } from "./sidebar-field";
import { ActionPriority } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const PRIORITY_CONFIG: Record<
  ActionPriority,
  { label: string; color: string; dot: string }
> = {
  NONE: {
    label: "Nenhuma",
    color: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  LOW: { label: "Baixa", color: "text-emerald-500", dot: "bg-emerald-500" },
  MEDIUM: { label: "Média", color: "text-yellow-500", dot: "bg-yellow-500" },
  HIGH: { label: "Alta", color: "text-orange-500", dot: "bg-orange-500" },
  URGENT: { label: "Urgente", color: "text-red-600", dot: "bg-red-600" },
};

interface PriorityFieldProps {
  value: ActionPriority;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function PriorityField({ value, onValueChange, disabled }: PriorityFieldProps) {
  const priorityConfig = PRIORITY_CONFIG[value];

  return (
    <SidebarField label="Prioridade">
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-xs bg-background w-full">
          <SelectValue>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "size-2 rounded-full shrink-0",
                  priorityConfig.dot,
                )}
              />
              <span className={priorityConfig.color}>
                {priorityConfig.label}
              </span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "size-2 rounded-full shrink-0",
                    cfg.dot,
                  )}
                />
                <span className={cfg.color}>{cfg.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SidebarField>
  );
}
