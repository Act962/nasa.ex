import { FormClosingPage } from "@/features/form-records/components/form-closing-page";

export default async function Page({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  return (
    <div className="mx-auto w-full min-w-0 px-4 md:px-10">
      <FormClosingPage formId={formId} />
    </div>
  );
}
