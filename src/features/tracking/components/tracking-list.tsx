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
dayjs.extend(utc);
dayjs.extend(relativeTime);

dayjs.locale("pt-BR");

interface Tracking {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

interface TrackingListProps {
  trackings: Tracking[];
}

export function TrackingList({ trackings }: TrackingListProps) {
  const searchParams = useSearchParams();
  const query = searchParams?.get("q") ?? "";

  const trackingList = query
    ? trackings.filter((tracking) =>
        tracking.name.toLowerCase().includes(query.toLowerCase())
      )
    : trackings;

  const hasPosts = trackingList.length > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 mt-8 gap-4">
      {hasPosts &&
        trackingList.map((tracking) => {
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
  );
}
