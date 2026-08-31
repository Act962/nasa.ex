"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import type { FormBlockInstance } from "@/features/form/types";
import type { LeadPrefillSource } from "@/features/form/context/form-prefill-context";

/**
 * Seletor "Preencher automaticamente com" (spec 0006).
 *
 * Vincula o bloco a um dos campos do step de identificação — nome, e-mail ou
 * telefone — para que ele nasça preenchido em vez de exigir que o usuário
 * digite a mesma informação duas vezes. Persiste em
 * `attributes.prefillFromLead`.
 *
 * Só lista fontes que estão sendo realmente coletadas: sem isso, o construtor
 * configuraria um vínculo que nunca funciona e só descobriria no formulário
 * publicado (D-5).
 */

const SOURCE_LABEL: Record<LeadPrefillSource, string> = {
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
};

const NONE_VALUE = "__none__";

export function PrefillFromLeadSelect({
  parentId,
  blockInstance,
}: {
  parentId: string;
  blockInstance: FormBlockInstance;
}) {
  const { formData, updateChildBlock } = useBuilderStore();
  const settings = formData?.settings as
    | {
        needLogin?: boolean;
        showName?: boolean;
        showEmail?: boolean;
        showPhone?: boolean;
      }
    | undefined;

  const needLogin = settings?.needLogin ?? true;
  const availableSources: LeadPrefillSource[] = [];
  if (settings?.showName ?? true) availableSources.push("name");
  if (settings?.showEmail ?? true) availableSources.push("email");
  if (settings?.showPhone ?? true) availableSources.push("phone");

  const attributes = (blockInstance.attributes ?? {}) as {
    prefillFromLead?: LeadPrefillSource | null;
  };
  const current = attributes.prefillFromLead ?? null;
  const isDisabled = !needLogin || availableSources.length === 0;

  function commit(nextValue: string) {
    const source =
      nextValue === NONE_VALUE ? null : (nextValue as LeadPrefillSource);
    updateChildBlock(parentId, blockInstance.id, {
      ...blockInstance,
      attributes: {
        ...(blockInstance.attributes ?? {}),
        prefillFromLead: source,
      },
    });
  }

  return (
    <div className="px-4 pt-1 pb-3">
      <div className="rounded-md border border-foreground/10 bg-foreground/[0.03] p-3 space-y-1.5">
        {/* Label acima e select em largura cheia: lado a lado, o rótulo
            quebrava em três linhas no painel estreito de propriedades. */}
        <span className="block text-[13px] font-medium">
          Preencher automaticamente com
        </span>
        <Select
          value={current ?? NONE_VALUE}
          disabled={isDisabled}
          onValueChange={commit}
        >
          <SelectTrigger
            size="sm"
            className="w-full"
            aria-label="Preencher automaticamente com"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>Não preencher</SelectItem>
            {availableSources.map((source) => (
              <SelectItem key={source} value={source}>
                {SOURCE_LABEL[source]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isDisabled ? (
          <p className="text-[11px] text-muted-foreground leading-tight">
            Disponível apenas quando <strong>Exigir identificação</strong> está
            ligado e há ao menos um campo do lead sendo coletado.
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground leading-tight">
            O campo nasce com o que o usuário informou no passo de
            identificação, e continua editável. Evita pedir a mesma informação
            duas vezes.
          </p>
        )}

        {/* Vínculo apontando para fonte que deixou de ser coletada: o campo
            nasce vazio em runtime, então avisamos aqui em vez de deixar o
            construtor descobrir no formulário publicado (CB-1/CB-2). */}
        {!isDisabled && current && !availableSources.includes(current) && (
          <p className="text-[11px] leading-tight text-amber-600 dark:text-amber-500">
            O campo <strong>{SOURCE_LABEL[current]}</strong> não está sendo
            coletado na identificação — este vínculo será ignorado.
          </p>
        )}
      </div>
    </div>
  );
}
