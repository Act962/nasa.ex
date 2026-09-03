"use client";

import { useQueryState } from "nuqs";
import { useCallback, useMemo } from "react";
import {
  CONVERSATION_SORT_OPTIONS,
  CONVERSATION_STATUS_FLOWS,
  CONVERSATION_TEMPERATURES,
  DEFAULT_CONVERSATION_SORT_BY,
  DEFAULT_CONVERSATION_SORT_DIRECTION,
  parseCsvOptions,
  type ConversationSortBy,
  type ConversationSortDirection,
  type ConversationStatusFlow,
} from "../lib/conversation-filters-state";

/**
 * Estado dos filtros avançados da lista de conversas (spec 0011).
 *
 * Mora na URL via `nuqs`, com as mesmas chaves do board (`participant`,
 * `temperature`, `status_flow`) — é o que permite reaproveitar
 * `ParticipantsSwitcher`, `TemperatureFilter` e `StatusFlowFilter` sem
 * duplicá-los aqui (D-3). Consequência aceita: filtro aplicado no board
 * acompanha o usuário até o chat.
 *
 * As etiquetas seguem fora daqui, em `useState` no `conversations-list`:
 * já funcionavam, indexam por `tagId` (o board usa `slug`) e unificar
 * exigiria mexer no que não está quebrado.
 */
export function useConversationFilters() {
  const [participantQuery, setParticipantQuery] = useQueryState("participant");
  const [temperatureQuery, setTemperatureQuery] = useQueryState("temperature");
  const [statusFlowQuery, setStatusFlowQuery] = useQueryState("status_flow");
  const [sortByQuery, setSortByQuery] = useQueryState("sort");
  const [sortDirectionQuery, setSortDirectionQuery] = useQueryState("sort_dir");

  const statusFlows = useMemo(
    () => parseCsvOptions(statusFlowQuery, CONVERSATION_STATUS_FLOWS),
    [statusFlowQuery],
  );

  const temperatures = useMemo(
    () => parseCsvOptions(temperatureQuery, CONVERSATION_TEMPERATURES),
    [temperatureQuery],
  );

  const sortBy: ConversationSortBy = useMemo(() => {
    const match = CONVERSATION_SORT_OPTIONS.find(
      (option) => option.value === sortByQuery,
    );
    return match?.value ?? DEFAULT_CONVERSATION_SORT_BY;
  }, [sortByQuery]);

  const sortDirection: ConversationSortDirection =
    sortDirectionQuery === "asc" ? "asc" : DEFAULT_CONVERSATION_SORT_DIRECTION;

  /**
   * Alterna um status. É o que faz os pills "Finalizados"/"Em atendimento"
   * e o painel "Status" compartilharem uma única fonte de verdade
   * (spec 0011, RF-4) — antes eram estados diferentes do mesmo campo.
   */
  const toggleStatusFlow = useCallback(
    (value: ConversationStatusFlow) => {
      const next = statusFlows.includes(value)
        ? statusFlows.filter((status) => status !== value)
        : [...statusFlows, value];
      setStatusFlowQuery(next.length > 0 ? next.join(",") : null);
    },
    [statusFlows, setStatusFlowQuery],
  );

  const setSortBy = useCallback(
    (value: ConversationSortBy) => {
      // Default não suja a URL — mantém o link limpo pra quem não mexeu.
      setSortByQuery(value === DEFAULT_CONVERSATION_SORT_BY ? null : value);
    },
    [setSortByQuery],
  );

  const setSortDirection = useCallback(
    (value: ConversationSortDirection) => {
      setSortDirectionQuery(
        value === DEFAULT_CONVERSATION_SORT_DIRECTION ? null : value,
      );
    },
    [setSortDirectionQuery],
  );

  const isSortDefault =
    sortBy === DEFAULT_CONVERSATION_SORT_BY &&
    sortDirection === DEFAULT_CONVERSATION_SORT_DIRECTION;

  const activeCount =
    (participantQuery ? 1 : 0) +
    (temperatures.length > 0 ? 1 : 0) +
    (statusFlows.length > 0 ? 1 : 0) +
    (isSortDefault ? 0 : 1);

  const clearAll = useCallback(() => {
    setParticipantQuery(null);
    setTemperatureQuery(null);
    setStatusFlowQuery(null);
    setSortByQuery(null);
    setSortDirectionQuery(null);
  }, [
    setParticipantQuery,
    setTemperatureQuery,
    setStatusFlowQuery,
    setSortByQuery,
    setSortDirectionQuery,
  ]);

  return {
    responsibleEmail: participantQuery,
    temperatures,
    statusFlows,
    sortBy,
    sortDirection,
    setSortBy,
    setSortDirection,
    toggleStatusFlow,
    activeCount,
    clearAll,
  };
}
