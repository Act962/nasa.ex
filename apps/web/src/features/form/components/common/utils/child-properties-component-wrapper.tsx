import { FormBlockInstance, FormBlockType } from "@/features/form/types";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { UseAsResponseLabelToggle } from "./use-as-response-label-toggle";

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
    </>
  );
}
