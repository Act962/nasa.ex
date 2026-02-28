import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  temperature: z.enum(["COLD", "HOT", "WARM", "VERY_HOT"]),
});

export type TemperatureFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TemperatureFormValues) => void;
  defaultValues?: Partial<TemperatureFormValues>;
}

export const TemperatureDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const form = useForm<TemperatureFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? {
      temperature: "COLD",
    },
  });

  const handleSubmit = (values: TemperatureFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Temperatura</DialogTitle>
          <DialogDescription>Mude a temperatura do lead</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            <Controller
              name="temperature"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Temperatura</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma temperatura" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COLD">Frio</SelectItem>
                      <SelectItem value="HOT">Quente</SelectItem>
                      <SelectItem value="WARM">Morno</SelectItem>
                      <SelectItem value="VERY_HOT">Muito Quente</SelectItem>
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
