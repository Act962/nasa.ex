"use client";

import {
  ArrowUpRightIcon,
  BriefcaseIcon,
  GitPullRequestArrowIcon,
} from "lucide-react";
import { useQueryTrackingConsultants } from "../../hooks/use-tracking-consultants";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useState } from "react";
import { ItemConsultor } from "./item-consultor";
import { ModalAddConsultor } from "./modal-add-consultor";

interface FlowAttendimentProps {
  trackingId: string;
}

export function FlowAttendiment({ trackingId }: FlowAttendimentProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { isLoadingTrackingConsultants, trackingConsultants } =
    useQueryTrackingConsultants(trackingId);

  return (
    <>
      <div className="flex w-full flex-col md:flex-row md:items-end justify-between gap-6 rounded-2xl">
        <div className="space-y-1 w-full">
          <div className="flex justify-between w-full gap-2">
            <div className="flex items-center gap-2">
              <GitPullRequestArrowIcon className="size-4 " />
              <h2 className="text-xl font-semibold">Fluxo de atendimento</h2>
            </div>
            <Button onClick={() => setModalOpen(true)}>
              Adicionar Consultor
            </Button>
          </div>
          <span>Consultores</span>

          {!isLoadingTrackingConsultants &&
            trackingConsultants?.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BriefcaseIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum atendente encontrado</EmptyTitle>
                  <EmptyDescription>
                    Adicione atendentes para seu atendimento ter mais dinamismo.
                  </EmptyDescription>
                </EmptyHeader>

                <Button size="sm" onClick={() => setModalOpen(true)}>
                  Adicionar consultor <ArrowUpRightIcon />
                </Button>
              </Empty>
            )}
          <div className="h-full overflow-y-auto mt-4 space-y-3">
            {!isLoadingTrackingConsultants &&
              trackingConsultants &&
              trackingConsultants.map((consultant) => (
                <ItemConsultor
                  key={consultant.user.id}
                  consultant={{ ...consultant.user }}
                  maxFlow={consultant.maxFlow}
                  currentFlow={consultant.currentFlow}
                  trackingId={consultant.trackingId}
                  consultantId={consultant.id}
                  isActive={consultant.isActive}
                />
              ))}
          </div>
        </div>
      </div>
      <ModalAddConsultor
        trackingId={trackingId}
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
