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
import { Textarea } from "@/components/ui/textarea";
import { useReasons } from "@/features/reasons/hooks/use-reasons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  type: z.enum(["WIN", "LOSS"]),
  reason: z.string().min(1, "Campo obrigatório"),
  observation: z.string().optional(),
});

export type WinLossFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: WinLossFormValues) => void;
  defaultValues?: Partial<WinLossFormValues>;
}

export const WinLossDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const params = useParams<{ trackingId: string }>();
  const form = useForm<WinLossFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? {
      type: "WIN",
      reason: "",
      observation: "",
    },
  });

  const { reasons, isLoading } = useReasons(
    params.trackingId,
    form.watch("type"),
  );

  const handleSubmit = (values: WinLossFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ganho/Perdido</DialogTitle>
          <DialogDescription>
            Marque o lead como ganho ou perdido
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <Controller
                name="type"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WIN">Ganho</SelectItem>
                      <SelectItem value="LOSS">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError />
            </Field>
            <Field>
              <FieldLabel>Motivo</FieldLabel>
              <Controller
                name="reason"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoading && (
                        <SelectItem value="loading">Carregando...</SelectItem>
                      )}
                      {!isLoading && reasons?.length === 0 && (
                        <SelectItem value="empty">
                          Nenhum motivo encontrado
                        </SelectItem>
                      )}
                      {!isLoading &&
                        reasons?.length > 0 &&
                        reasons.map((reason) => (
                          <SelectItem key={reason.id} value={reason.id}>
                            {reason.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError />
            </Field>
            <Field>
              <FieldLabel>Observações</FieldLabel>
              <Controller
                name="observation"
                control={form.control}
                render={({ field }) => (
                  <Textarea
                    placeholder="Observações"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <FieldError />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
