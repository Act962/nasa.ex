import { BookingForm } from "@/features/agenda/components/external-link/booking-form";

interface Props {
  params: Promise<{ orgSlug: string; agendaSlug: string }>;
}

export default async function Page({ params }: Props) {
  const { orgSlug, agendaSlug } = await params;

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-5">
      <BookingForm agendaSlug={agendaSlug} orgSlug={orgSlug} />
    </div>
  );
}
