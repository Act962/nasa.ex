import { Button } from "@/components/ui/button";
// import { mergeProps } from "@react-aria/utils";
import { useRef } from "react";
import {
  AriaButtonProps,
  useButton,
  useFocusRing,
  mergeProps,
} from "react-aria";
import { CalendarState } from "react-stately";

export function CalendarButton(
  props: AriaButtonProps<"button"> & {
    state?: CalendarState;
    side?: "left" | "right";
  },
) {
  const ref = useRef(null);

  const { buttonProps } = useButton(props, ref);
  const { focusProps } = useFocusRing();

  return (
    <Button
      variant="outline"
      size="icon-sm"
      ref={ref}
      disabled={props.isDisabled}
      {...mergeProps(buttonProps, focusProps)}
    >
      {props.children}
    </Button>
  );
}
