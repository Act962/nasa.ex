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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import z from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const filterConditionSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("status"),
    operator: z.enum(["is", "is_not"]),
    value: z.string().min(1, "Informe um status"),
  }),
  z.object({
    field: z.literal("tag"),
    operator: z.enum(["contains", "not_contains"]),
    value: z.string().min(1, "Informe uma tag"),
  }),
  z.object({
    field: z.literal("value"),
    operator: z.enum(["greater_than", "less_than"]),
    value: z.string().min(1, "Informe um valor"),
  }),
  z.object({
    field: z.literal("name"),
    operator: z.literal("equals"),
    value: z.string().min(1, "Informe um nome"),
  }),
  z.object({
    field: z.literal("email"),
    operator: z.literal("equals"),
    value: z.string().min(1, "Informe um e-mail"),
  }),
]);

export const filterNodeFormSchema = z.object({
  logic: z.enum(["and", "or"]),
  conditions: z
    .array(filterConditionSchema)
    .min(1, "Adicione ao menos uma condição"),
});

export type FilterCondition = z.infer<typeof filterConditionSchema>;
export type FilterLeadFormValues = z.infer<typeof filterNodeFormSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIELD_OPTIONS: { value: FilterCondition["field"]; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "tag", label: "Tag" },
  { value: "value", label: "Valor do lead" },
  { value: "name", label: "Nome" },
  { value: "email", label: "E-mail" },
];

const OPERATOR_OPTIONS: Record<
  FilterCondition["field"],
  { value: string; label: string }[]
> = {
  status: [
    { value: "is", label: "está no status" },
    { value: "is_not", label: "não está no status" },
  ],
  tag: [
    { value: "contains", label: "contém a tag" },
    { value: "not_contains", label: "não contém a tag" },
  ],
  value: [
    { value: "greater_than", label: "maior que" },
    { value: "less_than", label: "menor que" },
  ],
  name: [{ value: "equals", label: "é igual a" }],
  email: [{ value: "equals", label: "é igual a" }],
};

const DEFAULT_CONDITION: FilterCondition = {
  field: "status",
  operator: "is",
  value: "",
};

const getDefaultOperator = (field: FilterCondition["field"]): string =>
  OPERATOR_OPTIONS[field][0].value;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: FilterLeadFormValues) => void;
  defaultValues?: Partial<FilterLeadFormValues>;
}

export const FilterNodeDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const form = useForm<FilterLeadFormValues>({
    resolver: zodResolver(filterNodeFormSchema),
    defaultValues: defaultValues ?? {
      logic: "and",
      conditions: [{ ...DEFAULT_CONDITION }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "conditions",
  });

  const handleSubmit = (values: FilterLeadFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Filtro</DialogTitle>
          <DialogDescription>
            Configure as condições para continuar o fluxo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            {/* Logic AND / OR */}
            <Controller
              name="logic"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Lógica entre condições</FieldLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="and">
                        AND — todas as condições devem ser verdadeiras
                      </SelectItem>
                      <SelectItem value="or">
                        OR — ao menos uma condição deve ser verdadeira
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            {/* Conditions */}
            <div className="flex flex-col gap-3">
              <FieldLabel>Condições</FieldLabel>

              {fields.map((fieldItem, index) => {
                const currentField = form.watch(`conditions.${index}.field`);

                return (
                  <div
                    key={fieldItem.id}
                    className="flex items-start gap-2 rounded-md border p-3"
                  >
                    {/* Field selector */}
                    <Controller
                      name={`conditions.${index}.field`}
                      control={form.control}
                      render={({ field }) => (
                        <Select
                          onValueChange={(val) => {
                            const newField = val as FilterCondition["field"];
                            field.onChange(newField);
                            // Reset operator and value when field changes
                            form.setValue(
                              `conditions.${index}.operator` as never,
                              getDefaultOperator(newField) as never,
                            );
                            form.setValue(
                              `conditions.${index}.value` as never,
                              "" as never,
                            );
                          }}
                          value={field.value}
                        >
                          <SelectTrigger className="w-[140px] shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />

                    {/* Operator selector */}
                    <Controller
                      name={`conditions.${index}.operator` as never}
                      control={form.control}
                      render={({ field }) => (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value as string}
                        >
                          <SelectTrigger className="w-[180px] shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATOR_OPTIONS[currentField]?.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />

                    {/* Value input */}
                    <Controller
                      name={`conditions.${index}.value`}
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <div className="flex flex-1 flex-col gap-1">
                          <Input
                            {...field}
                            placeholder={
                              currentField === "value" ? "0.00" : "Valor..."
                            }
                            type={currentField === "value" ? "number" : "text"}
                            className={
                              fieldState.error ? "border-destructive" : ""
                            }
                          />
                          {fieldState.error && (
                            <span className="text-xs text-destructive">
                              {fieldState.error.message}
                            </span>
                          )}
                        </div>
                      )}
                    />

                    {/* Remove button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                );
              })}

              {form.formState.errors.conditions?.root && (
                <span className="text-xs text-destructive">
                  {form.formState.errors.conditions.root.message}
                </span>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => append({ ...DEFAULT_CONDITION })}
              >
                <PlusIcon className="mr-2 size-4" />
                Adicionar condição
              </Button>
            </div>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button type="submit">Salvar filtro</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
