"use client";

import { boolean } from "zod";
import { useSuspenseTrackings } from "../hooks/use-trackings";
import { EntityHeader } from "@/components/entity-components";

export const TrackingList = () => {
  const trackings = useSuspenseTrackings();

  return <p>{JSON.stringify(trackings.data, null, 2)}</p>;
};

export const TrackingsHeader = ({ disabled }: { disabled?: boolean }) => {
  return (
    <>
      <EntityHeader
        title="Trackings"
        description="Gerencie os principais processos da sua empresa e acompanhe suas
          métricas."
        newButtonLabel="Criar novo tracking"
        onNew={() => {}}
        disabled={disabled}
        isCreating={false}
      />
    </>
  );
};
