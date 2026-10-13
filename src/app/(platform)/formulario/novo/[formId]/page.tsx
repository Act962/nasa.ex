import { RecordClientPicker } from "@/features/form-records/components/record-client-picker";

export default async function Page({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  return <RecordClientPicker formId={formId} />;
}
