"use client";

import { orpc } from "@/lib/orpc";
import { createPortal } from "react-dom";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { StatusForm } from "./status-form";
import { useEffect, useMemo, useState } from "react";
import { StatusItem } from "./status-item";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { LeadItem } from "./lead-item";
import { Footer } from "./footer";
import { useLostOrWin } from "@/hooks/use-lost-or-win";
import { useDeletLead } from "@/hooks/use-delete-lead";
import { useQueryState } from "nuqs";
import dayjs from "dayjs";

interface ListContainerProps {
  trackingId: string;
}

type StatusWithLeads = {
  id: string;
  name: string;
  color: string | null;
  order: number;
  trackingId: string;
  leads: {
    id: string;
    name: string;
    email: string | null;
    order: number;
    phone: string | null;
    statusId: string;
    tags: string[];
    createdAt: Date;
    responsible: {
      image: string | null;
      email: string;
      name: string;
    } | null;
  }[];
};

export function ListContainer({ trackingId }: ListContainerProps) {
  const params = useParams<{ trackingId: string }>();
  const [dateInit] = useQueryState("date_init");
  const [dateEnd] = useQueryState("date_end");
  const [participantFilter] = useQueryState("participant");

  const { onOpen } = useLostOrWin();
  const { onOpen: onOpenDeleteLead } = useDeletLead();

  const queryInput = useMemo(
    () => ({
      trackingId,
      date_init: dateInit ? dayjs(dateInit).startOf("day").toDate() : undefined,
      date_end: dateEnd ? dayjs(dateEnd).endOf("day").toDate() : undefined,
      participant: participantFilter || undefined,
    }),
    [trackingId, dateInit, dateEnd, participantFilter]
  );

  const { data } = useSuspenseQuery(
    orpc.status.list.queryOptions({
      input: queryInput,
    })
  );
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [activeColumn, setActiveColumn] = useState<StatusWithLeads | null>(
    null
  );
  const [activeLead, setActiveLead] = useState<
    StatusWithLeads["leads"][0] | null
  >(null);
  const [originalLeadPosition, setOriginalLeadPosition] = useState<{
    statusId: string;
    index: number; // ← Mudamos de 'order' para 'index'
  } | null>(null);
  const [statusData, setStatusData] = useState(data.status);

  const updateColumnOrder = useMutation(
    orpc.status.updateOrder.mutationOptions({
      onSuccess: () => {
        toast.success("Coluna atualizada com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao atualizar coluna, tente novamente");
        setStatusData(data.status);
      },
    })
  );

  const updateLeadOrder = useMutation(
    orpc.leads.updateOrder.mutationOptions({
      onSuccess: () => {
        toast.success("Lead atualizada com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao atualizar lead, tente novamente mais tarde");
        // Reverte o estado em caso de erro
        setStatusData(data.status);
      },
    })
  );

  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "Column") {
      setActiveColumn(event.active.data.current.column);
      return;
    }

    if (event.active.data.current?.type === "Lead") {
      const lead = event.active.data.current.lead;
      setActiveLead(lead);

      // CORREÇÃO: Salva o índice REAL atual do lead no array
      const statusIndex = statusData.findIndex(
        (status) => status.id === lead.statusId
      );

      if (statusIndex !== -1) {
        const leadIndex = statusData[statusIndex].leads.findIndex(
          (l) => l.id === lead.id
        );

        if (leadIndex !== -1) {
          setOriginalLeadPosition({
            statusId: lead.statusId,
            index: leadIndex, // ← Índice real no array
          });
        }
      }
      return;
    }
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveColumn(null);
    setActiveLead(null);

    const { active, over } = event;

    if (!over) {
      setOriginalLeadPosition(null);
      return;
    }

    // Verifica se foi solto em um botão do footer
    if (
      active.data.current?.type === "Lead" &&
      over.data.current?.type === "FooterButton"
    ) {
      const leadData: StatusWithLeads["leads"][0] = active.data.current.lead;
      const footerAction = over.data.current.action;

      // Aqui você pode adicionar a lógica específica para cada ação
      switch (footerAction) {
        case "excluir":
          onOpenDeleteLead({ ...leadData, trackingId });
          break;
        case "ganho":
          onOpen(leadData.id, "WIN");
          break;
        case "perdido":
          onOpen(leadData.id, "LOSS");
          break;
      }

      // Reverte a posição visual do lead
      setStatusData(data.status);
      setOriginalLeadPosition(null);
      return;
    }

    // Movimentação de colunas
    if (
      active.data.current?.type === "Column" &&
      over.data.current?.type === "Column"
    ) {
      const activeColumnId = active.id;
      const overColumnId = over.id;

      if (activeColumnId === overColumnId) {
        setOriginalLeadPosition(null);
        return;
      }

      const activeColumnIndex = statusData.findIndex(
        (col) => col.id === activeColumnId
      );
      const overColumnIndex = statusData.findIndex(
        (col) => col.id === overColumnId
      );

      const items = arrayMove(statusData, activeColumnIndex, overColumnIndex);

      setStatusData(items);

      const newOrder = items.findIndex((col) => col.id === activeColumnId);

      updateColumnOrder.mutate({
        newOrder,
        statusId: active.id as string,
        trackingId: params.trackingId,
      });

      setOriginalLeadPosition(null);
      return;
    }

    // Movimentação de leads
    if (active.data.current?.type === "Lead") {
      const activeId = active.id;

      // Verifica se temos posição original salva
      if (!originalLeadPosition) {
        return;
      }

      // Encontra a nova posição e statusId do lead no estado atual
      let newStatusId = "";
      let newIndex = -1;

      for (const status of statusData) {
        const leadIndex = status.leads.findIndex(
          (lead) => lead.id === activeId
        );
        if (leadIndex !== -1) {
          newStatusId = status.id;
          newIndex = leadIndex;
          break;
        }
      }

      // Limpa a posição original ao final
      setOriginalLeadPosition(null);

      // Valida se encontrou a nova posição
      if (!newStatusId || newIndex < 0) {
        return;
      }

      // CORREÇÃO: Compara índices ao invés de order
      const positionChanged =
        newStatusId !== originalLeadPosition.statusId ||
        newIndex !== originalLeadPosition.index;

      if (positionChanged) {
        updateLeadOrder.mutate({
          leadId: activeId as string,
          statusId: newStatusId,
          newOrder: newIndex,
        });
      }
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveLead = active.data.current?.type === "Lead";
    const isOverLead = over.data.current?.type === "Lead";

    if (!isActiveLead) return;

    // Lead sobre Lead (mesma coluna ou diferente)
    if (isActiveLead && isOverLead) {
      setStatusData((statuses) => {
        const activeIndex = statuses.findIndex((status) =>
          status.leads.some((lead) => lead.id === activeId)
        );
        const overIndex = statuses.findIndex((status) =>
          status.leads.some((lead) => lead.id === overId)
        );

        if (activeIndex === -1 || overIndex === -1) return statuses;

        const activeStatus = statuses[activeIndex];
        const overStatus = statuses[overIndex];

        const activeLeadIndex = activeStatus.leads.findIndex(
          (lead) => lead.id === activeId
        );
        const overLeadIndex = overStatus.leads.findIndex(
          (lead) => lead.id === overId
        );

        // Movendo dentro da mesma coluna
        if (activeIndex === overIndex) {
          const newLeads = arrayMove(
            activeStatus.leads,
            activeLeadIndex,
            overLeadIndex
          );

          const newStatuses = [...statuses];
          newStatuses[activeIndex] = {
            ...activeStatus,
            leads: newLeads,
          };

          return newStatuses;
        }
        // Movendo para outra coluna
        else {
          const activeLeads = [...activeStatus.leads];
          const [movedLead] = activeLeads.splice(activeLeadIndex, 1);

          const overLeads = [...overStatus.leads];
          overLeads.splice(overLeadIndex, 0, {
            ...movedLead,
            statusId: overStatus.id,
          });

          const newStatuses = [...statuses];
          newStatuses[activeIndex] = {
            ...activeStatus,
            leads: activeLeads,
          };
          newStatuses[overIndex] = {
            ...overStatus,
            leads: overLeads,
          };

          return newStatuses;
        }
      });
    }

    // Lead sobre Coluna (área vazia da coluna)
    const isOverColumn = over.data.current?.type === "Column";

    if (isActiveLead && isOverColumn) {
      setStatusData((statuses) => {
        const activeIndex = statuses.findIndex((status) =>
          status.leads.some((lead) => lead.id === activeId)
        );
        const overIndex = statuses.findIndex((status) => status.id === overId);

        if (activeIndex === -1 || overIndex === -1) return statuses;

        const activeStatus = statuses[activeIndex];
        const overStatus = statuses[overIndex];

        const activeLeadIndex = activeStatus.leads.findIndex(
          (lead) => lead.id === activeId
        );

        // Se já está na mesma coluna, não faz nada
        if (activeIndex === overIndex) return statuses;

        const activeLeads = [...activeStatus.leads];
        const [movedLead] = activeLeads.splice(activeLeadIndex, 1);

        const overLeads = [
          ...overStatus.leads,
          { ...movedLead, statusId: overStatus.id },
        ];

        const newStatuses = [...statuses];
        newStatuses[activeIndex] = {
          ...activeStatus,
          leads: activeLeads,
        };
        newStatuses[overIndex] = {
          ...overStatus,
          leads: overLeads,
        };

        return newStatuses;
      });
    }
  }

  useEffect(() => {
    setStatusData(data.status);
  }, [data.status]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      <div className="grid grid-rows-[1fr_auto] h-full">
        <ol className="flex gap-x-3 overflow-x-auto">
          <SortableContext items={statusData.map((col) => col.id)}>
            {statusData.map((status, index) => {
              return <StatusItem key={status.id} index={index} data={status} />;
            })}
          </SortableContext>
          <StatusForm />
          <div className="shrink-0 w-1" />
        </ol>

        <Footer />
      </div>

      {typeof window !== "undefined" &&
        createPortal(
          <DragOverlay>
            {activeColumn && (
              <StatusItem index={activeColumn.order} data={activeColumn} />
            )}
            {activeLead && <LeadItem data={activeLead} />}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
