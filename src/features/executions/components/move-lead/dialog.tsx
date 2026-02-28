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
import {
  useQueryStatus,
  useQueryTrackings,
} from "@/features/trackings/hooks/use-trackings";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import { useEffect } from "react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  trackingId: z.string(),
  statusId: z.string(),
});

export type MoveLeadFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: MoveLeadFormValues) => void;
  defaultValues?: Partial<MoveLeadFormValues>;
}

export const MoveLeadDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const [openPopover, setOpenPopover] = useState(false);
  const form = useForm<MoveLeadFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      trackingId: defaultValues?.trackingId || "",
      statusId: defaultValues?.statusId || "",
    },
  });
  const trackingId = form.watch("trackingId");
  const { trackings, isLoading } = useQueryTrackings();
  const { status } = useQueryStatus({
    trackingId,
  });

  useEffect(() => {
    form.reset({
      trackingId: defaultValues?.trackingId || "",
      statusId: defaultValues?.statusId || "",
    });
  }, [defaultValues, form, open]);

  const handleSubmit = (values: MoveLeadFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Lead</DialogTitle>
          <DialogDescription>Configure the move lead</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            <Controller
              name="trackingId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Tracking</FieldLabel>
                  <Popover open={openPopover} onOpenChange={setOpenPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                      >
                        {field.value ? (
                          trackings?.find(
                            (tracking) => tracking.id === field.value,
                          )?.name
                        ) : (
                          <span className="text-muted-foreground">
                            Selecione um tracking
                          </span>
                        )}
                        {/* <ChevronsUpDown className="size-4" /> */}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0  w-[310px] sm:w-[440px]"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Procurar..." />
                        <CommandList>
                          <CommandEmpty>
                            Nenhum resultado encontrado.
                          </CommandEmpty>
                          <CommandGroup>
                            {trackings.map((tracking) => (
                              <CommandItem
                                key={tracking.id}
                                value={`${tracking.name}-${tracking.id}`}
                                onSelect={() => {
                                  field.onChange(tracking.id);
                                  setOpenPopover(false);
                                }}
                              >
                                <CheckIcon
                                  className={cn(
                                    "size-4",
                                    field.value === tracking.id
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
                    </PopoverContent>
                  </Popover>
                </Field>
              )}
            />

            <Controller
              name="statusId"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Coluna</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={
                      isLoading ||
                      !status ||
                      status.length === 0 ||
                      !trackingId ||
                      trackingId.length === 0
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {status.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
