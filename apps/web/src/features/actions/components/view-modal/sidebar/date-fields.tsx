import { DatePicker } from "../../data-picker";
import { SidebarField } from "./sidebar-field";

interface DateFieldsProps {
  dueDate?: Date;
  startDate?: Date;
  onDueDateChange: (date: Date) => void;
  onStartDateChange: (date: Date) => void;
}

export function DateFields({
  dueDate,
  startDate,
  onDueDateChange,
  onStartDateChange,
}: DateFieldsProps) {
  return (
    <>
      <SidebarField label="Data de início">
        <DatePicker
          value={startDate}
          onChange={onStartDateChange}
          placeholder="Sem data"
          className="h-8 text-xs bg-background"
        />
      </SidebarField>
      <SidebarField label="Data de entrega">
        <DatePicker
          value={dueDate}
          onChange={onDueDateChange}
          placeholder="Sem data"
          className="h-8 text-xs bg-background"
        />
      </SidebarField>
    </>
  );
}
