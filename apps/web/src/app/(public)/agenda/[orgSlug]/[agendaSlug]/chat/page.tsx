import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { BookingChat } from "@/features/public-booking-chat/components/booking-chat";

interface Props {
  params: Promise<{ orgSlug: string; agendaSlug: string }>;
}

/**
 * Página pública de chat de agendamento.
 * Acessível sem autenticação via /agenda/[orgSlug]/[agendaSlug]/chat
 */
export default async function BookingChatPage({ params }: Props) {
  const { orgSlug, agendaSlug } = await params;

  const agenda = await prisma.agenda.findFirst({
    where: {
      slug: agendaSlug,
      organization: { slug: orgSlug },
      isActive: true,
    },
    select: {
      name: true,
      organization: {
        select: { name: true, logo: true },
      },
    },
  });

  if (!agenda) {
    notFound();
  }

  return (
    <div className="min-h-screen w-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg h-[calc(100svh-2rem)] max-h-[700px] border rounded-2xl shadow-lg overflow-hidden flex flex-col bg-background">
        <BookingChat
          orgSlug={orgSlug}
          agendaSlug={agendaSlug}
          agendaName={agenda.name}
          orgName={agenda.organization.name}
          orgLogo={agenda.organization.logo ?? undefined}
        />
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { orgSlug, agendaSlug } = await params;

  const agenda = await prisma.agenda.findFirst({
    where: {
      slug: agendaSlug,
      organization: { slug: orgSlug },
      isActive: true,
    },
    select: {
      name: true,
      organization: { select: { name: true } },
    },
  });

  if (!agenda) {
    return { title: "Agenda não encontrada" };
  }

  return {
    title: `Agendar — ${agenda.name} | ${agenda.organization.name}`,
    description: `Agende sua consulta com ${agenda.name} de forma rápida pelo chat.`,
  };
}
