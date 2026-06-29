import { Loader2 } from "lucide-react";

import { cva, type VariantProps } from "class-variance-authority";

const spinnerVariants = cva(`text-muted-foreground animate-spin`, {
  variants: {
    size: {
      default: "size-4",
      sm: "size-2",
      lg: "size-6",
      icon: "size-10",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

interface SpinnerProps extends VariantProps<typeof spinnerVariants> {}

export function Spinner({ size }: SpinnerProps = {}) {
  return <Loader2 className={spinnerVariants({ size })}></Loader2>;
}
