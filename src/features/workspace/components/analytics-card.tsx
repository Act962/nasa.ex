import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowBigDownIcon, ArrowBigUpIcon } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";

export const AnalyticsCard = (props: {
  title: string;
  value: number;
  isLoading: boolean;
  type: "task" | "project" | "member";
  onClick?: () => void;
}) => {
  const { title, value, isLoading, type, onClick } = props;

  const getArrowIcon = () => {
    if (type === "task") {
      return value > 0 ? (
        <ArrowBigDownIcon strokeWidth={2.5} className="h-4 w-4 text-destructive" />
      ) : (
        <ArrowBigUpIcon strokeWidth={2.5} className="h-4 w-4 text-success" />
      );
    }
    if (type === "project") {
      return value > 0 ? (
        <ArrowBigUpIcon strokeWidth={2.5} className="h-4 w-4 text-success" />
      ) : (
        <ArrowBigDownIcon strokeWidth={2.5} className="h-4 w-4 text-destructive" />
      );
    }
    if (type === "member") {
      return value > 0 ? (
        <ArrowBigUpIcon strokeWidth={2.5} className="h-4 w-4 text-success" />
      ) : (
        <ArrowBigDownIcon strokeWidth={2.5} className="h-4 w-4 text-destructive" />
      );
    }
    return null;
  };
  const interactive = !!onClick;

  return (
    <Card
      className={
        "shadow-none w-full bg-transparent transition-colors gap-1 py-3 sm:gap-6 sm:py-6 " +
        (interactive
          ? "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          : "")
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 px-3 pb-1 sm:px-6 sm:pb-2">
        <CardTitle className="min-w-0 text-[11px] font-medium leading-tight sm:text-sm">
          {title}
        </CardTitle>
        <div className="shrink-0">{getArrowIcon()}</div>
      </CardHeader>
      <CardContent className="flex w-full flex-1 items-end justify-center px-3 sm:px-6">
        <div className="text-center text-3xl font-bold sm:text-5xl">
          {isLoading ? (
            <OrbitaSpinner className="mx-auto h-8 w-8 sm:h-9 sm:w-9" />
          ) : (
            value
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalyticsCard;
