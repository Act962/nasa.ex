interface PageProps {
  params: Promise<{ agendaId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { agendaId } = await params;

  return <div>Agenda {agendaId}</div>;
}
