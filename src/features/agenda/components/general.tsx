import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";

const url = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export function General() {
  return (
    <form className="space-y-4">
      <Card className="bg-transparent">
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Título</FieldLabel>
            <Input placeholder="Título da agenda" />
          </Field>

          <Field>
            <FieldLabel>Descrição</FieldLabel>
            <Textarea placeholder="Descrição da agenda" />
          </Field>

          <Field>
            <FieldLabel>Link</FieldLabel>
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <InputGroupText>{url}/.../</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput className="pl-0!" />
            </InputGroup>
          </Field>
        </CardContent>
      </Card>

      <Card className="bg-transparent">
        <CardContent>
          <Field>
            <FieldLabel>Duração</FieldLabel>
            <InputGroup>
              <InputGroupInput placeholder="30" min={1} type="number" />
              <InputGroupAddon align="inline-end">
                <InputGroupText>minutos</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>Salvar</Button>
      </div>
    </form>
  );
}
