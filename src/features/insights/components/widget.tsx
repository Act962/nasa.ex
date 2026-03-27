import { Card } from "@/components/ui/card";
import {
  useMutationDeleteWidget,
  useQueryListWidgets,
  useQueryWidgetByTag,
} from "../hooks/use-widget";
import { AddWidgetPerson } from "./add-widget-person";
import { TagIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getContrastColor } from "@/utils/get-contrast-color";
import { Skeleton } from "@/components/ui/skeleton";

interface WidgetListProps {
  organizationIds: string[];
}

export function WidgetList(data: WidgetListProps) {
  const { widgets, isLoading } = useQueryListWidgets({
    organizationIds: data.organizationIds,
  });
  const widgetsSorted = widgets.sort((a, b) => a.order - b.order);
  return (
    <Card className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full min-h-40 px-4 ">
        {isLoading &&
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`skeletron-${index}`} className="w-full min-h-40" />
          ))}
        {!isLoading &&
          widgetsSorted &&
          widgetsSorted.map((widget) => {
            const config =
              typeof widget.config === "string"
                ? JSON.parse(widget.config)
                : widget.config;

            return (
              <div key={widget.id}>
                {widget.type === "LEADS_BY_TAG" && (
                  <WidgetTag
                    title={widget.title}
                    tagId={config?.tagid}
                    organizationId={widget.organizationId}
                    id={widget.id}
                    organizationIds={data.organizationIds}
                  />
                )}
              </div>
            );
          })}
        <AddWidgetPerson
          organizationIds={data.organizationIds}
          lastWidgetOrder={widgetsSorted.length}
        />
      </div>
    </Card>
  );
}

interface WidgetTagProps {
  title: string;
  tagId: string;
  organizationId: string;
  id: string;
  organizationIds: string[];
}

export function WidgetTag({
  title,
  tagId,
  organizationId,
  id,
  organizationIds,
}: WidgetTagProps) {
  const { data, isLoading } = useQueryWidgetByTag({
    tagId,
    organizationId,
  });

  const mutation = useMutationDeleteWidget(organizationIds);

  const handleDeleteWidget = () => {
    mutation.mutate({
      id,
    });
  };

  return (
    <div className="h-full w-full">
      <Card className="w-full h-full px-4 py-4 flex flex-col justify-between rounded-2xl shadow-sm hover:shadow-md transition-all">
        {/* Header */}
        <div className="flex w-full items-start justify-between gap-2">
          <div className="flex flex-col w-full">
            <h1 className="text-lg font-semibold leading-tight">{title}</h1>
            <h3 className="text-xs text-muted-foreground">Por tags</h3>
          </div>

          <div className="flex items-center gap-x-2">
            {mutation.isPending ? (
              <div className="size-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={handleDeleteWidget}
                className="hover:bg-destructive/10"
              >
                <Trash2Icon className="size-4" />
              </Button>
            )}

            <div
              style={{
                backgroundColor: data?.color ?? "#000",
                color: getContrastColor(data?.color ?? "#000"),
              }}
              className="bg-foreground/10 rounded-md p-2"
            >
              <TagIcon className="size-4" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-2 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="size-10 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <p
              className="text-3xl font-bold tracking-tight"
              style={{ color: data?.color ?? "#000" }}
            >
              {data?.count ?? 0}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
