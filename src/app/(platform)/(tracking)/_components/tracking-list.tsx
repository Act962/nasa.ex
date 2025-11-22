"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import dayjs from "dayjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import "dayjs/locale/pt-br";
import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Folder } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTracking } from "@/hooks/use-tracking-modal";
dayjs.extend(utc);
dayjs.extend(relativeTime);

dayjs.locale("pt-BR");

export function TrackingList() {
  const searchParams = useSearchParams();
  const query = searchParams?.get("q") ?? "";
  const { onOpen } = useTracking()

  const { data: trackings, isLoading } = useSuspenseQuery(
    orpc.tracking.list.queryOptions()
  );

  const trackingList = query
    ? trackings.filter((tracking) =>
        tracking.name.toLowerCase().includes(query.toLowerCase())
      )
    : trackings;

  const hasPosts = trackingList.length > 0;

  return (
    <div className="mt-8">
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-full" />
          ))}
        </div>
      )}
      {hasPosts && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {trackingList.map((tracking) => {
            return (
              <Link key={tracking.id} href={`/tracking/${tracking.id}`}>
                <Card className="cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle>{tracking.name}</CardTitle>
                    <CardDescription>
                      {tracking.description
                        ? tracking.description
                        : "Sem descrição"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-end">
                      <span className="text-sm text-muted-foreground">
                        Criado {dayjs(tracking.createdAt).fromNow()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      {!hasPosts && !isLoading && (
        <div className="flex items-center justify-center mt-16">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Folder />
              </EmptyMedia>
              <EmptyTitle>Nenhum tracking encontrado</EmptyTitle>
              <EmptyDescription>
                Você não possui nenhum trackings criado ainda. Começe criando
                seu primeiro tracking
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex gap-2">
                <Button onClick={onOpen}>Criar novo tracking</Button>
              </div>
            </EmptyContent>
          </Empty>
        </div>
      )}
    </div>
  );
}