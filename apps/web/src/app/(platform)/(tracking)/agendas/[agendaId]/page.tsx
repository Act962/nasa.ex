import { EntityLoading } from "@/components/entity-components";
import { EditorAgenda } from "@/features/agenda/components/editor-agenda";
import { Suspense } from "react";

interface PageProps {
  params: Promise<{ agendaId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { agendaId } = await params;

  return (
    <>
      <Suspense fallback={<EntityLoading />}>
        <EditorAgenda agendaId={agendaId} />
      </Suspense>
    </>
  );
}
