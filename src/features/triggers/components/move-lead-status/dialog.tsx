import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryStatus } from "@/features/trackings/hooks/use-trackings";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import z from "zod";

const formSchema = z.object({
  statusId: z.string().min(1, "Selecione um status"),
});

export type MoveLeadStatusTriggerFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: MoveLeadStatusTriggerFormValues) => void;
  defaultValues?: Partial<MoveLeadStatusTriggerFormValues>;
}

export const MoveLeadStatusTriggerDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const { trackingId } = useParams<{ trackingId: string }>();

  const form = useForm<MoveLeadStatusTriggerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? {
      statusId: "",
    },
  });

  const handleSubmit = (values: MoveLeadStatusTriggerFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  const { status } = useQueryStatus({
    trackingId,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover Lead para Status</DialogTitle>
          <DialogDescription>
            Configure quando o lead será movido para o status
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Controller
                control={form.control}
                name="statusId"
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um status" />
                    </SelectTrigger>
                    <SelectContent>
                      {status?.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
