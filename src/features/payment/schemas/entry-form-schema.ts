import { z } from "zod";
import { isValidDateValue } from "../lib/dates";

/**
 * Validação dos formulários de lançamento (nova receita/despesa e edição).
 *
 * Mora aqui, e não dentro dos componentes, porque as duas telas precisam das
 * mesmas regras e das mesmas mensagens: antes cada uma tinha o seu `if` e um
 * toast "Valor inválido" que não dizia qual campo estava errado nem por quê.
 */

export const MAX_INSTALLMENTS = 12;

export const entryFormSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Informe uma descrição")
    .max(200, "Descrição muito longa (máximo de 200 caracteres)"),
  amount: z
    .number({ error: "Informe o valor" })
    .int("Valor inválido")
    .positive("O valor precisa ser maior que zero"),
  dueDate: z
    .string()
    .min(1, "Informe a data de vencimento")
    .refine(isValidDateValue, "Data de vencimento inválida"),
  installments: z
    .number()
    .int()
    .min(1, "Mínimo de 1 parcela")
    .max(MAX_INSTALLMENTS, `Máximo de ${MAX_INSTALLMENTS} parcelas`),
});

export type EntryFormValues = z.infer<typeof entryFormSchema>;

/** Só os campos que a edição altera — sem parcelas. */
export const entryEditSchema = entryFormSchema.omit({ installments: true });

export type EntryFieldErrors = Partial<
  Record<keyof EntryFormValues, string>
>;

/**
 * Achata os issues do Zod em `{ campo: primeira mensagem }`, que é o formato
 * que o formulário renderiza abaixo de cada input.
 */
export function toFieldErrors(error: z.ZodError): EntryFieldErrors {
  const fieldErrors: EntryFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof EntryFormValues | undefined;
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}
