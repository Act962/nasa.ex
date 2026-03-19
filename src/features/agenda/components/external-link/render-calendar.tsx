"use client";

import { DayOfWeek } from "@/generated/prisma/enums";
import { Calendar } from "./calendar";
import { getLocalTimeZone, today } from "@internationalized/date";
import { DateValue } from "react-aria";

interface RenderCalendarProps {
  availabilities: {
    id: string;
    isActive: boolean;
    dayOfWeek: DayOfWeek;
  }[];
}

export function RenderCalendar({ availabilities }: RenderCalendarProps) {
  const safeAvailabilities = availabilities ?? [];

  const availabilityMap: Partial<Record<DayOfWeek, boolean>> =
    Object.fromEntries(
      safeAvailabilities.map((a) => [a.dayOfWeek, a.isActive]),
    );

  const isDateUnavailable = (date: DateValue) => {
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

  return (
    <Calendar
      minValue={today(getLocalTimeZone())}
      isDateUnavailable={isDateUnavailable}
    />
  );
}
