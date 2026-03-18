import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";
import { useUpdateAgenda } from "../hooks/use-agenda";

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
    updateAgenda.mutate({
      agendaId: defaultValues.id,
      trackingId: data.trackingId,
    });
  };

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="bg-transparent">
        <CardContent>
          <Field>
            <FieldLabel>Tracking</FieldLabel>
            <Select {...form.register("trackingId")}>
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
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>Salvar</Button>
      </div>
    </form>
  );
}
