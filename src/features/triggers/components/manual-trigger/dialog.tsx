import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useLeadSearch } from "@/features/leads/hooks/use-lead-search";
import { useQueryStatus } from "@/features/status/hooks/use-status";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { useDebouncedValue } from "@/hooks/use-debouced";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";

const formSchema = z.object({
  leadId: z.string().min(1, "Selecione um lead"),
  trackingId: z.string().optional(),
  statusId: z.string().optional(),
});

export type ManualTriggerFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ManualTriggerFormValues) => void;
  defaultValues?: Partial<ManualTriggerFormValues>;
}

export const ManualTriggerDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const [openPopover, setOpenPopover] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, 500);

  const form = useForm<ManualTriggerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? {
      leadId: "",
      trackingId: "",
      statusId: "",
    },
  });

  const trackingId = form.watch("trackingId");
  const statusId = form.watch("statusId");
  const leadId = form.watch("leadId");

  const { trackings, isLoading: isLoadingTrackings } = useQueryTrackings();
  const { status, isStatusLoading } = useQueryStatus({
    trackingId: trackingId || "",
  });

  const { leads, isLoading: isLoadingLeads } = useLeadSearch({
    trackingId,
    statusId,
    search: debouncedSearch,
    enabled: open,
  });

  const handleSubmit = (values: ManualTriggerFormValues) => {
    onSubmit(values);

    onOpenChange(false);
  };

  const selectedLead = leads?.find((l) => l.id === leadId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Gatilho Manual</DialogTitle>
          <DialogDescription>
            Inicie um fluxo manualmente para um lead específico.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            {/* Filtro de Tracking */}
            <Controller
              name="trackingId"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Tracking</FieldLabel>
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      form.setValue("statusId", "");
                      form.setValue("leadId", "");
                    }}
                    value={field.value}
                    disabled={isLoadingTrackings}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um tracking" />
                    </SelectTrigger>
                    <SelectContent>
                      {trackings?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            {/* Filtro de Status */}
            <Controller
              name="statusId"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Status (Opcional)</FieldLabel>
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      form.setValue("leadId", "");
                    }}
                    value={field.value}
                    disabled={!trackingId || isStatusLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          trackingId
                            ? "Selecione um status"
                            : "Selecione um tracking primeiro"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {status?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            {/* Seleção de Lead */}
            <Controller
              name="leadId"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Lead</FieldLabel>
                  <Popover open={openPopover} onOpenChange={setOpenPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openPopover}
                        className="w-full justify-between font-normal"
                      >
                        {field.value
                          ? selectedLead?.name || "Lead selecionado"
                          : "Procurar lead..."}
                        {isLoadingLeads ? <Spinner /> : null}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Buscar por nome, email ou telefone..."
                          value={searchValue}
                          onValueChange={setSearchValue}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {isLoadingLeads
                              ? "Buscando leads..."
                              : "Nenhum lead encontrado."}
                          </CommandEmpty>
                          <CommandGroup>
                            {leads?.map((lead) => (
                              <CommandItem
                                key={lead.id}
                                value={lead.id}
                                onSelect={() => {
                                  field.onChange(lead.id);
                                  setOpenPopover(false);
                                }}
                              >
                                <CheckIcon
                                  className={cn(
                                    "mr-2 size-4",
                                    field.value === lead.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{lead.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {lead.email || lead.phone || "Sem contato"}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={!leadId}>
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
