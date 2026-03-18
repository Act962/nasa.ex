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
import { Textarea } from "@/components/ui/textarea";

export function Workflow() {
  return (
    <form className="space-y-4">
      <Card className="bg-transparent">
        <CardContent>
          <Field>
            <FieldLabel>Tracking</FieldLabel>
            <Input placeholder="Atendimento" />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>Salvar</Button>
      </div>
    </form>
  );
}
