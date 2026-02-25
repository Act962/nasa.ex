import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useListHistoric } from "../hooks/use-lead";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { LeadAction } from "@/generated/prisma/enums";
import { ACTION_CONFIG } from "./types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ListHistoricProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

export function ListHistoric({
  leadId,
  open,
  onOpenChange,
  children,
}: ListHistoricProps) {
  const { data, isLoading } = useListHistoric(leadId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="pb-6">
          <SheetTitle>Histórico</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          <div className="flex flex-col gap-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner />
              </div>
            ) : !data?.historic || data.historic.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nenhum histórico encontrado</EmptyTitle>
                  <EmptyDescription>
                    Nenhum histórico registrado para este lead até o momento.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              data.historic.map((item) => {
                const config = ACTION_CONFIG[item.action];
                const nameUser = item.user ? item.user.name : "Sistema";
                return (
                  <Item key={item.id}>
                    <ItemContent>
                      <ItemTitle className="flex items-center gap-2">
                        <span
                          className={cn(config.className, "p-1 rounded-sm")}
                        >
                          {config.icon}
                        </span>
                        {config.label}
                      </ItemTitle>
                      <ItemDescription>
                        {item.notes || "Sem notas"}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="flex flex-col items-end gap-2 text-end">
                      <span className="text-xs text-muted-foreground">
                        {format(
                          new Date(item.createdAt),
                          "dd/MM/yyyy HH:mm:ss",
                        )}
                      </span>
                      <span className="text-xs font-semibold text-foreground ">
                        {nameUser}
                      </span>
                    </ItemActions>
                  </Item>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
