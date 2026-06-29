import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const DEFAULT_START_HOUR = 8;
const DEFAULT_START_MINUTE = 0;

const formSchema = z.object({
  startHour: z.number().int().min(0).max(23),
  startMinute: z.number().int().min(0).max(59),
});

export type FirstInteractionOfDayFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: FirstInteractionOfDayFormValues) => void;
  defaultValues?: Partial<FirstInteractionOfDayFormValues>;
}

const pad = (value: number) => String(value).padStart(2, "0");

export const FirstInteractionOfDayDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const form = useForm<FirstInteractionOfDayFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startHour: defaultValues?.startHour ?? DEFAULT_START_HOUR,
      startMinute: defaultValues?.startMinute ?? DEFAULT_START_MINUTE,
    },
  });

  const handleSubmit = (values: FirstInteractionOfDayFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Primeira Interação do Dia</DialogTitle>
          <DialogDescription>
            Acionado quando um lead que já está na base volta a enviar uma
            mensagem pela primeira vez no dia.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="first-interaction-start-time">
              Início do dia (horário de corte)
            </FieldLabel>
            <Controller
              control={form.control}
              name="startHour"
              render={({ field: hourField }) => (
                <Controller
                  control={form.control}
                  name="startMinute"
                  render={({ field: minuteField }) => (
                    <Input
                      id="first-interaction-start-time"
                      type="time"
                      className="w-40"
                      value={`${pad(hourField.value)}:${pad(minuteField.value)}`}
                      onChange={(event) => {
                        const [hour, minute] = event.target.value
                          .split(":")
                          .map((part) => Number.parseInt(part, 10));
                        hourField.onChange(Number.isNaN(hour) ? 0 : hour);
                        minuteField.onChange(Number.isNaN(minute) ? 0 : minute);
                      }}
                    />
                  )}
                />
              )}
            />
            <p className="text-[12px] text-muted-foreground">
              O &quot;dia&quot; vira neste horário (fuso de Brasília /
              America/Sao_Paulo), não à meia-noite. Ex.: com corte às 08:00,
              uma mensagem às 07:00 ainda conta como o dia anterior; a primeira
              mensagem após as 08:00 dispara a automação.
            </p>
          </Field>

          <DialogFooter>
            <Button type="submit">Salvar Gatilho</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
