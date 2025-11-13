"use client";

import { orpc } from "@/lib/orpc";
import { useSuspenseQuery } from "@tanstack/react-query";
import { StatusForm } from "./status-form";
import { useEffect, useState } from "react";
import { StatusItem } from "./status-item";

interface ListContainerProps {
  trackingId: string;
}

export function ListContainer({ trackingId }: ListContainerProps) {
  const { data, isLoading } = useSuspenseQuery(
    orpc.status.list.queryOptions({
      input: {
        trackingId,
      },
    })
  );

  const [statusData, setStatusData] = useState(data.status);

  useEffect(() => {
    setStatusData(data.status);
  }, [data]);

  return (
    <ol className="flex gap-x-3 h-full">
      {statusData.map((status, index) => {
        return <StatusItem key={status.id} index={index} data={status} />;
      })}
      <StatusForm />
      <div className="shrink-0 w-1" />
    </ol>
  );
}
