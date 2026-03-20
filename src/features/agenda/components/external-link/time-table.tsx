import { useLocale } from "react-aria";
import { useQueryPublicAgendaTimeSlots } from "../../hooks/use-public-agenda";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  selectedDate: Date;
  orgSlug: string;
  agendaSlug: string;
}

export function TimeTable({ selectedDate, orgSlug, agendaSlug }: Props) {
  const { locale } = useLocale();
  const { timeSlots, isLoading } = useQueryPublicAgendaTimeSlots({
    orgSlug,
    agendaSlug,
    date: dayjs(selectedDate).format("YYYY-MM-DD"),
  });

  return (
    <div>
      <p className="text-base font-semibold">
        <span className="text-sm text-muted-foreground capitalize">
          {dayjs(selectedDate).locale(locale).format("MMMM. DD")}
        </span>
      </p>

      <div className="mt-3 max-h-[350px] overflow-auto scroll-cols-tracking">
        {isLoading && (
          <div className="flex items-center justify-center">
            <Spinner />
          </div>
        )}
        {!isLoading &&
          timeSlots &&
          timeSlots.length > 0 &&
          timeSlots.map((slot) => (
            <Button
              key={slot.id}
              asChild
              className="w-full mb-2"
              variant="outline"
            >
              <Link
                href={`?date=${dayjs(selectedDate).locale(locale).format("YYYY-MM-DD")}&time=${slot.startTime}`}
              >
                {slot.startTime}
              </Link>
            </Button>
          ))}

        {!isLoading && timeSlots?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum horário disponível
          </p>
        )}
      </div>
    </div>
  );
}
