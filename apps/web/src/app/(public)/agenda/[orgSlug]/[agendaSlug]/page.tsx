import Link from "next/link";
import { BookingForm } from "@/features/agenda/components/external-link/booking-form";
import { Button } from "@/components/ui/button";
import { MessageCircleIcon, CalendarIcon } from "lucide-react";

interface Props {
  params: Promise<{ orgSlug: string; agendaSlug: string }>;
}

export default async function Page({ params }: Props) {
  const { orgSlug, agendaSlug } = await params;

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center p-5 gap-4">
      {/* Seletor de modo */}
      <div className="flex items-center gap-2 rounded-full border bg-background px-2 py-1.5 shadow-sm">
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="rounded-full gap-1.5 text-xs h-7 px-3"
        >
          <span>
            <CalendarIcon className="size-3" />
            Formulário
          </span>
        </Button>
      </div>

      <BookingForm agendaSlug={agendaSlug} orgSlug={orgSlug} />
    </div>
  );
}
