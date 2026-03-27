import { FormBlockInstance, HandleBlurFunc } from "@/features/form/types";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { FormSettings } from "@/generated/prisma/client";

export function ChildFormComponentWrapper({
  blockInstance,
  errorMessage,
  isError,
  handleBlur,
  settings,
}: {
  blockInstance: FormBlockInstance;
  isError?: boolean;
  errorMessage?: string;
  handleBlur?: HandleBlurFunc;
  settings?: FormSettings | null;
}) {
  const FormComponent = FormBlocks[blockInstance.blockType]?.formComponent;
  if (!FormComponent) return null;

  return (
    <FormComponent
      blockInstance={blockInstance}
      isError={isError}
      errorMessage={errorMessage}
      handleBlur={handleBlur}
      settings={settings}
    />
  );
}
