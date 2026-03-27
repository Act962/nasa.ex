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
        <div className="relative rounded-full p-[1.5px] overflow-hidden">
          <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#8b5cf6,#ec4899,#f97316,#8b5cf6)] animate-spin [animation-duration:3s]" />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="relative z-10 rounded-full gap-1.5 text-xs h-7 px-3 bg-background hover:bg-background/80"
          >
            <Link href={`/agenda/${orgSlug}/${agendaSlug}/chat`}>
              <MessageCircleIcon className="size-3" />
              Agendar com IA
            </Link>
          </Button>
        </div>
      </div>

      <BookingForm agendaSlug={agendaSlug} orgSlug={orgSlug} />
    </div>
  );
}
