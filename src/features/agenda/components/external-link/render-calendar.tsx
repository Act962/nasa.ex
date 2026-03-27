"use client";

import { DayOfWeek } from "@/generated/prisma/enums";
import { Calendar } from "./calendar";
import {
  getLocalTimeZone,
  parseDate,
  today,
  CalendarDate,
} from "@internationalized/date";
import { DateValue } from "react-aria";
import { useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import { useRouter, useSearchParams } from "next/navigation";

interface RenderCalendarProps {
  availabilities: {
    id: string;
    isActive: boolean;
    dayOfWeek: DayOfWeek;
  }[];
  blockedDates?: string[]; // YYYY-MM-DD
}

export function RenderCalendar({ availabilities, blockedDates = [] }: RenderCalendarProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const safeAvailabilities = availabilities ?? [];
  const [date, setDate] = useState(() => {
    const dateParam = searchParams.get("date");

    return dateParam ? parseDate(dateParam) : today(getLocalTimeZone());
  });

  const handleDateChange = (date: DateValue) => {
    setDate(date as CalendarDate);

    const url = new URL(window.location.href);
    url.searchParams.set("date", date.toString());

    router.push(url.toString());
  };

  const availabilityMap: Partial<Record<DayOfWeek, boolean>> =
    Object.fromEntries(
      safeAvailabilities.map((a) => [a.dayOfWeek, a.isActive]),
    );

  const blockedDatesSet = new Set(blockedDates);

  const isDateUnavailable = (date: DateValue) => {
    // Verificar bloqueio específico da data
    if (blockedDatesSet.has(date.toString())) return true;

    const jsDay = date.toDate(getLocalTimeZone()).getDay();

    const dayMap: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];

    const dayEnum = dayMap[jsDay];

    const isActive = availabilityMap[dayEnum];

    if (isActive === undefined) return true;

    return !isActive;
  };

  useEffect(() => {
    const dateParam = searchParams.get("date");

    if (dateParam) {
      setDate(parseDate(dateParam));
    }
  }, [searchParams]);

  return (
    <Calendar
      minValue={today(getLocalTimeZone())}
      isDateUnavailable={isDateUnavailable}
      value={date}
      onChange={handleDateChange}
    />
  );
}
