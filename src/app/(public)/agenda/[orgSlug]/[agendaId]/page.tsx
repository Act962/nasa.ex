interface Props {
  params: Promise<{ orgSlug: string; agendaId: string }>;
}

export default async function Page({ params }: Props) {
  const { orgSlug, agendaId } = await params;

  return (
    <div>
      {orgSlug} - {agendaId}
    </div>
  );
}
