import { cn } from "@/lib/utils";
import { useRef } from "react";
import { CalendarState } from "react-stately";
import {
  CalendarDate,
  getLocalTimeZone,
  isToday,
} from "@internationalized/date";
import { mergeProps, useCalendarCell, useFocusRing } from "react-aria";

export function CalendarCell({
  state,
  date,
  currentMonth,
  isUnavailable,
  //   timezone = getLocalTimeZone(),
}: {
  state: CalendarState;
  date: CalendarDate;
  currentMonth: CalendarDate;
  isUnavailable?: boolean;
  //   timezone: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const {
    cellProps,
    buttonProps,
    isSelected,
    isOutsideVisibleRange,
    isDisabled,
    formattedDate,
  } = useCalendarCell({ date }, state, ref);

  const { focusProps, isFocusVisible } = useFocusRing();

  const isDateToday = isToday(date, getLocalTimeZone());

  const finalIsDisabled = isDisabled || isUnavailable;

  return (
    <td
      {...cellProps}
      className={cn("py-0.5 px-0.5 relative", isFocusVisible ? "z-10" : "z-0")}
    >
      <div
        {...mergeProps(buttonProps, focusProps)}
        ref={ref}
        hidden={isOutsideVisibleRange}
        className={cn("size-10 sm:size-12 outline-none group rounded-md")}
      >
        <div
          className={cn(
            "size-full rounded-sm flex items-center justify-center text-sm font-semibold",
            finalIsDisabled ? "text-muted-foreground cursor-not-allowed" : "",
            isSelected ? "bg-primary text-white" : "",
            !isSelected && !finalIsDisabled
              ? "hover:bg-primary/10 cursor-pointer"
              : "",
          )}
        >
          {formattedDate}
          {isDateToday && (
            <div
              className={cn(
                "absolute bottom-2 left-1/2 transform -translate-x-1/2 translate-y-1/2 size-1.5 bg-primary rounded-full",
                isSelected && "bg-white",
              )}
            />
          )}
        </div>
      </div>
    </td>
  );
}
