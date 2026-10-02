import { cva, type VariantProps } from "class-variance-authority";
import { OrbitaSpinner } from "@/components/orbita-spinner";

const spinnerVariants = cva("", {
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

type SpinnerProps = VariantProps<typeof spinnerVariants>;

export function Spinner({ size }: SpinnerProps = {}) {
  return <OrbitaSpinner className={spinnerVariants({ size })} />;
}
