import { FormBlockInstance, FormBlockType } from "@/features/form/types";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { UseAsResponseLabelToggle } from "./use-as-response-label-toggle";
import { PrefillFromLeadSelect } from "./prefill-from-lead-select";
import { RecordFieldSettings } from "./record-field-settings";

// Blocos cujo valor pode ser usado como **título da resposta** (ex: campo
// "Nº O.S" → label da resposta vira "00123"). Restringe pra inputs textuais
// simples — não faz sentido pra Image, Signature, FileUpload, etc.
const LABEL_SOURCE_ELIGIBLE_BLOCKS: ReadonlySet<FormBlockType> = new Set([
  "TextField",
  "TextArea",
  "MaskedField",
  "Dropdown",
  "DatePicker",
]);

// Blocos que podem ser pré-preenchidos com nome/e-mail/telefone do step de
// identificação (spec 0006, 6.1). Só entrada de texto livre — nenhuma fonte
// da identificação tem formato de data, opção fechada ou arquivo.
const LEAD_PREFILL_ELIGIBLE_BLOCKS: ReadonlySet<FormBlockType> = new Set([
  "TextField",
  "TextArea",
  "MaskedField",
]);

// Blocos que podem ter nome-chave de ficha (spec 0075, RF-5): os que guardam
// um valor de texto curto, legível numa coluna de lista.
const RECORD_FIELD_ELIGIBLE_BLOCKS: ReadonlySet<FormBlockType> = new Set([
  "TextField",
  "MaskedField",
  "Dropdown",
  "RadioSelect",
  "DatePicker",
  "NumberMeasure",
  "Calculation",
  "OrbitLookup",
  "AutoNumber",
]);

export function ChildPropertiesComponentWrapper({
  index,
  parentId,
  blockInstance,
}: {
  index: number;
  parentId: string;
  blockInstance: FormBlockInstance;
}) {
  const PropertiesComponent =
    FormBlocks[blockInstance.blockType].propertiesComponent;
  if (!PropertiesComponent) return null;

  const isEligibleForLabelSource = LABEL_SOURCE_ELIGIBLE_BLOCKS.has(
    blockInstance.blockType,
  );
  const isEligibleForLeadPrefill = LEAD_PREFILL_ELIGIBLE_BLOCKS.has(
    blockInstance.blockType,
  );

  return (
    <>
      <PropertiesComponent
        positionIndex={index}
        parentId={parentId}
        blockInstance={blockInstance}
      />
      {/* Toggle "Usar valor como título da resposta" — exibido só para
          inputs textuais simples, abaixo das propriedades específicas do
          bloco. Persiste em `attributes.useAsResponseLabel`, lido no
          submit/save por `deriveResponseLabel`. */}
      {isEligibleForLabelSource && (
        <UseAsResponseLabelToggle
          parentId={parentId}
          blockInstance={blockInstance}
        />
      )}
      {/* Vínculo com o step de identificação — persiste em
          `attributes.prefillFromLead` e é resolvido no preenchimento. */}
      {isEligibleForLeadPrefill && (
        <PrefillFromLeadSelect
          parentId={parentId}
          blockInstance={blockInstance}
        />
      )}
      {RECORD_FIELD_ELIGIBLE_BLOCKS.has(blockInstance.blockType) && (
        <RecordFieldSettings
          key={blockInstance.id}
          parentId={parentId}
          blockInstance={blockInstance}
          canBeReferenceDate={blockInstance.blockType === "DatePicker"}
        />
      )}
    </>
  );
}
