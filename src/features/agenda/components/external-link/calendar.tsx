"use client";
import { CalendarProps, useCalendar, useLocale, DateValue } from "react-aria";
import { createCalendar } from "@internationalized/date";
import { useCalendarState } from "react-stately";
import { CalendarHeader } from "./calendar-header";
import { CalendarGrid } from "./calendar-grid";

interface CalendarExtentedProps extends CalendarProps<DateValue> {
  isDateUnavailable?: (date: DateValue) => boolean;
}

export function Calendar({
  isDateUnavailable,
  ...props
}: CalendarExtentedProps) {
  const { locale } = useLocale();
  const state = useCalendarState({
    ...props,
    visibleDuration: { months: 1 },
    locale,
    createCalendar,
  });

  const { calendarProps, prevButtonProps, nextButtonProps, title } =
    useCalendar(props, state);

  return (
    <div {...calendarProps} className="inline-block">
      <CalendarHeader
        state={state}
        calendarProps={calendarProps}
        prevButtonProps={prevButtonProps}
        nextButtonProps={nextButtonProps}
      />

      <div className="flex gap-8">
        <CalendarGrid
          state={state}
          timezone=""
          isDateUnavailable={isDateUnavailable}
        />
      </div>
    </div>
  );
}
