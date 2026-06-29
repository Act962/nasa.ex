import { FormBuilderClient } from "./form-builder-client";

export default async function Page({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  return <FormBuilderClient formId={formId} />;
}
