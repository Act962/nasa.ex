import { FormBlockInstance } from "@/features/form/types";
import { FormBlocks } from "@/features/form/lib/form-blocks";

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

  return (
    <PropertiesComponent
      positionIndex={index}
      parentId={parentId}
      blockInstance={blockInstance}
    />
  );
}
