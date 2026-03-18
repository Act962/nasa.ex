import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";
import { useUpdateAgenda } from "../hooks/use-agenda";
import { slugify } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const url = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const formSchema = z.object({
  name: z.string(),
  description: z.string().optional().nullable(),
  slug: z.string().optional(),
  slotDuration: z.number().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Agenda {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  slotDuration: number;
}

interface GeneralProps {
  defaultValues: Agenda;
}

export function General({ defaultValues }: GeneralProps) {
  const updateAgenda = useUpdateAgenda();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues || {
      name: "",
      description: null,
      slug: "",
      slotDuration: 30,
      isActive: true,
    },
  });

  const onSubmit = async (data: FormData) => {
    updateAgenda.mutate({
      agendaId: defaultValues.id,
      name: data.name,
      description: data.description,
      slug: data.slug,
      slotDuration: data.slotDuration,
    });
  };

  const isSubbmitting = updateAgenda.isPending;

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="bg-transparent">
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Título</FieldLabel>
            <Input
              placeholder="Título da agenda"
              disabled={isSubbmitting}
              {...form.register("name")}
            />
            <FieldError>{form.formState.errors.name?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel>Descrição</FieldLabel>
            <Textarea
              placeholder="Descrição da agenda"
              disabled={isSubbmitting}
              {...form.register("description")}
            />
            <FieldError>
              {form.formState.errors.description?.message}
            </FieldError>
          </Field>

          <Field>
            <FieldLabel>Link</FieldLabel>
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <InputGroupText>{url}/.../</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                className="pl-0!"
                disabled={isSubbmitting}
                {...form.register("slug", {
                  onChange: (e) => {
                    form.setValue("slug", slugify(e.target.value));
                  },
                })}
              />
            </InputGroup>
            <FieldError>{form.formState.errors.slug?.message}</FieldError>
          </Field>
        </CardContent>
      </Card>

      <Card className="bg-transparent">
        <CardContent>
          <Field>
            <FieldLabel>Duração</FieldLabel>
            <InputGroup>
              <InputGroupInput
                placeholder="30"
                min={1}
                type="number"
                disabled={isSubbmitting}
                {...form.register("slotDuration", {
                  valueAsNumber: true,
                })}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>minutos</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldError>
              {form.formState.errors.slotDuration?.message}
            </FieldError>
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubbmitting}>
          {isSubbmitting && <Spinner />}
          Salvar
        </Button>
      </div>
    </form>
  );
}
