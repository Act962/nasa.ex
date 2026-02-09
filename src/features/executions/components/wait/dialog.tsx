import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const minutesSchema = z.object({
  type: z.literal("MINUTES"),
  minutes: z.number(),
});

const hoursSchema = z.object({
  type: z.literal("HOURS"),
  hours: z.number(),
});

const daysSchema = z.object({
  type: z.literal("DAYS"),
  days: z.number(),
  // hours: z.number(),
  // minutes: z.number(),
});

const formSchema = z.discriminatedUnion("type", [
  minutesSchema,
  hoursSchema,
  daysSchema,
]);

export type WaitFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: WaitFormValues) => void;
  defaultValues?: Partial<WaitFormValues>;
}

export const WaitDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const form = useForm<WaitFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? {
      type: "MINUTES",
      minutes: 5,
    },
  });

  const timerType = form.watch("type");

  const handleSubmit = (values: WaitFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Esperar</DialogTitle>
          <DialogDescription>Configure o tempo de espera</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Tipo de espera</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de espera" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MINUTES">Minutos</SelectItem>
                      <SelectItem value="HOURS">Horas</SelectItem>
                      <SelectItem value="DAYS">Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            {timerType === "MINUTES" && (
              <Controller
                control={form.control}
                name="minutes"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>Minutos</FieldLabel>
                    <Input
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      type="number"
                      min={1}
                      max={59}
                      placeholder="59"
                    />
                    {fieldState.error?.message && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </Field>
                )}
              />
            )}
            {timerType === "HOURS" && (
              <Controller
                control={form.control}
                name="hours"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>Horas</FieldLabel>
                    <Input
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      type="number"
                      min={1}
                      max={23}
                      placeholder="23"
                    />
                    {fieldState.error?.message && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </Field>
                )}
              />
            )}
            {timerType === "DAYS" && (
              <>
                <Controller
                  control={form.control}
                  name="days"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Dias</FieldLabel>
                      <Input
                        type="number"
                        value={field.value}
                        min={1}
                        max={365}
                        placeholder="3 dias"
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                      {fieldState.error?.message && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </Field>
                  )}
                />

                {/* <div className="flex items-center gap-2">
                  <Controller
                    control={form.control}
                    name="hours"
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>Horas</FieldLabel>
                        <Input {...field} type="number" />
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="minutes"
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>Minutos</FieldLabel>
                        <Input {...field} type="number" />
                      </Field>
                    )}
                  />
                </div> */}
              </>
            )}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
