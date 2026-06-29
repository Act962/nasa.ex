import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ConversationsPainel() {
  return (
    <div className="flex h-full w-full flex-col bg-background text-sidebar-foreground">
      <div className="flex flex-col gap-3.5 border-b p-2">
        <Select value="Todos" defaultValue="Todos" onValueChange={()=>{}}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Cliente 1</SelectItem>
            <SelectItem value="2">Cliente 2</SelectItem>
            <SelectItem value="3">Cliente 3</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
