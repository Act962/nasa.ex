import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Loader,
  ArrowBigDownIcon,
  ArrowBigUpIcon,
} from "lucide-react";

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
        <ArrowBigDownIcon strokeWidth={2.5} className="h-4 w-4 text-red-500" />
      ) : (
        <ArrowBigUpIcon strokeWidth={2.5} className="h-4 w-4 text-green-500" />
      );
    }
    if (type === "project") {
      return value > 0 ? (
        <ArrowBigUpIcon strokeWidth={2.5} className="h-4 w-4 text-green-500" />
      ) : (
        <ArrowBigDownIcon strokeWidth={2.5} className="h-4 w-4 text-red-500" />
      );
    }
    if (type === "member") {
      return value > 0 ? (
        <ArrowBigUpIcon strokeWidth={2.5} className="h-4 w-4 text-green-500" />
      ) : (
        <ArrowBigDownIcon strokeWidth={2.5} className="h-4 w-4 text-red-500" />
      );
    }
    return null;
  };
  const interactive = !!onClick;

  return (
    <Card
      className={
        "shadow-none w-full bg-transparent transition-colors " +
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-1">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className="mb-[0.2px]">{getArrowIcon()}</div>
        </div>
        <Activity
          strokeWidth={2.5}
          className="h-4 w-4  text-muted-foreground"
        />
      </CardHeader>
      <CardContent className="w-full">
        <div className="text-3xl font-bold">
          {isLoading ? <Loader className="w-6 h-6 animate-spin" /> : value}
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalyticsCard;
