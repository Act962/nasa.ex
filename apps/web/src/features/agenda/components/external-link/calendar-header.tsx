"use client";

import type { CalendarState } from "react-stately";
import type { DOMAttributes, FocusableElement } from "@react-types/shared";
import { type AriaButtonProps, useDateFormatter } from "react-aria";
import { VisuallyHidden } from "@react-aria/visually-hidden";
import { CalendarButton } from "./calendar-button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

export const CalendarHeader = ({
  state,
  calendarProps,
  prevButtonProps,
  nextButtonProps,
}: {
  state: CalendarState;
  calendarProps: DOMAttributes<FocusableElement>;
  prevButtonProps: AriaButtonProps<"button">;
  nextButtonProps: AriaButtonProps<"button">;
}) => {
  const monthDateFormatter = useDateFormatter({
    month: "long",
    year: "numeric",
    timeZone: state.timeZone,
  });

  const [monthName, _, year] = monthDateFormatter
    .formatToParts(state.visibleRange.start.toDate(state.timeZone))
    .map((part) => part.value);

  return (
    <div className="flex items-center pb-2 tiny:pb-4">
      <VisuallyHidden>
        <h2>{calendarProps["aria-label"]}</h2>
      </VisuallyHidden>
      <h2 className="capitalize font-semibold text-sm tiny:text-base">
        {monthName}{" "}
        <span className="text-muted-foreground text-xs tiny:text-sm font-medium">
          {year}
        </span>
      </h2>
      <div className="flex items-center gap-1 tiny:gap-2 ml-auto">
        <CalendarButton {...prevButtonProps} side="left">
          <ChevronLeftIcon className="size-3.5 tiny:size-4" />
        </CalendarButton>
        <CalendarButton {...nextButtonProps} side="right">
          <ChevronRightIcon className="size-3.5 tiny:size-4" />
        </CalendarButton>
      </div>
    </div>
  );
};
