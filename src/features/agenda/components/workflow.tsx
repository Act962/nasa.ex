import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import { useUpdateAgenda } from "../hooks/use-agenda";
import { Spinner } from "@/components/ui/spinner";

const formSchema = z.object({
  trackingId: z.string().min(1, "Selecione um tracking"),
});

type FormSchema = z.infer<typeof formSchema>;

interface AgendaWorkflow {
  id: string;
  trackingId: string;
}

interface WorkflowProps {
  defaultValues: AgendaWorkflow;
}

export function Workflow({ defaultValues }: WorkflowProps) {
  const { trackings } = useQueryTrackings();
  const updateAgenda = useUpdateAgenda();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues || {
      trackingId: "",
    },
  });

  const onSubmit = async (data: FormSchema) => {
    console.log("Submitting form with data:", data);
    updateAgenda.mutate({
      agendaId: defaultValues.id,
      trackingId: data.trackingId,
    });
  };

  const isSubmitting = updateAgenda.isPending;

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="bg-transparent">
        <CardContent>
          <Controller
            control={form.control}
            name="trackingId"
            render={({ field }) => (
              <Field>
                <FieldLabel>Tracking</FieldLabel>
                <Select
                  disabled={isSubmitting}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um tracking" />
                  </SelectTrigger>
                  <SelectContent>
                    {trackings.map((tracking) => (
                      <SelectItem key={tracking.id} value={tracking.id}>
                        {tracking.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>
                  {form.formState.errors.trackingId?.message}
                </FieldError>
              </Field>
            )}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting && <Spinner />}
          Salvar
        </Button>
      </div>
    </form>
  );
}
