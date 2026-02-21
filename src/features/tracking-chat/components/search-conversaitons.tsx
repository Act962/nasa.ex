import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { CheckIcon, FilterIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useQueryTrackings,
  useQueryStatus,
} from "@/features/trackings/hooks/use-trackings";
import { cn } from "@/lib/utils";

type AlignType = "end" | "center" | "start" | undefined;

interface SearchConversationsProps {
  search: string;
  onSearchChange: (value: string) => void;
  trackingId: string | null;
  onTrackingChange: (id: string | null) => void;
  statusId: string | null;
  onStatusChange: (id: string | null) => void;
  align?: AlignType;
}

export function SearchConversations({
  search,
  onSearchChange,
  trackingId,
  onTrackingChange,
  statusId,
  onStatusChange,
  align = "start",
}: SearchConversationsProps) {
  const { trackings } = useQueryTrackings();
  const { status: statuses } = useQueryStatus({
    trackingId: trackingId ?? "",
  });

  const handleTrackingSelect = (id: string) => {
    const next = trackingId === id ? null : id;
    if (next !== trackingId) {
      onStatusChange(null);
    }
    onTrackingChange(next);
  };

  const handleStatusSelect = (id: string) => {
    const next = statusId === id ? null : id;
    onStatusChange(next);
  };

  return (
    <InputGroup className="w-full min-w-full">
      <InputGroupInput
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar conversas..."
      />
      <InputGroupAddon>
        <SearchIcon className="size-4" />
      </InputGroupAddon>
      {search && (
        <InputGroupAddon
          align={"inline-end"}
          onClick={() => onSearchChange("")}
          className="cursor-pointer"
        >
          <XIcon className="size-4" />
        </InputGroupAddon>
      )}
      <InputGroupAddon align={"inline-end"}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <FilterIcon className="size-3 cursor-pointer" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 p-3 space-y-4" align={align}>
            <Field>
              <FieldLabel className="text-[10px]  font-bold opacity-50">
                Tracking
              </FieldLabel>
              <Command className="border rounded-md mt-1">
                <CommandInput placeholder="Buscar fluxo..." className="h-8" />
                <CommandList className="max-h-32">
                  <CommandEmpty>Nenhum fluxo encontrado.</CommandEmpty>
                  <CommandGroup>
                    {trackings.map((tracking) => (
                      <CommandItem
                        key={tracking.id}
                        value={tracking.id}
                        onSelect={() => handleTrackingSelect(tracking.id)}
                        className="text-xs"
                      >
                        <CheckIcon
                          className={cn(
                            "mr-2 h-3 w-3",
                            trackingId === tracking.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {tracking.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </Field>

            <Field>
              <FieldLabel className="text-[10px] font-bold opacity-50">
                Status
              </FieldLabel>
              <Command className="border rounded-md mt-1">
                <CommandInput placeholder="Buscar status..." className="h-8" />
                <CommandList className="max-h-32">
                  {!trackingId ? (
                    <CommandEmpty className="text-xs p-4 text-center">
                      Selecione um fluxo primeiro.
                    </CommandEmpty>
                  ) : statuses.length === 0 ? (
                    <CommandEmpty className="text-xs p-4 text-center">
                      Nenhum status encontrado.
                    </CommandEmpty>
                  ) : (
                    <CommandEmpty>Nenhum status encontrado.</CommandEmpty>
                  )}
                  <CommandGroup>
                    {statuses.map((status) => (
                      <CommandItem
                        key={status.id}
                        onSelect={() => handleStatusSelect(status.id)}
                        className="text-xs"
                      >
                        <CheckIcon
                          className={cn(
                            "mr-2 h-3 w-3",
                            statusId === status.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {status.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </Field>

            <div className="pt-2 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="text-[10px] h-7"
                onClick={() => {
                  onTrackingChange(null);
                  onStatusChange(null);
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </InputGroupAddon>
    </InputGroup>
  );
}
