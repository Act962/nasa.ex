import { AppointmentCalendar } from "@/features/trackings/components/calendar/appointment-calendar";

type Props = {
  params: Promise<{ trackingId: string }>;
};

export default async function Page({ params }: Props) {
  const { trackingId } = await params;

  return (
    <div className="h-full w-full">
      <AppointmentCalendar trackingId={trackingId} />
    </div>
  );
}
