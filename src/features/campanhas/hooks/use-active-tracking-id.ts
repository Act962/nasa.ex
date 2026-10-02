import { useActiveNumberStore } from "../stores/use-active-number-store";
import { useSendingNumbers } from "./use-sending-numbers";

/** Número ativo: o escolhido pelo usuário ou, sem escolha, o primeiro conectado. */
export function useActiveTrackingId(): string | null {
  const { data: sendingNumbers } = useSendingNumbers();
  const selectedTrackingId = useActiveNumberStore((state) => state.selectedTrackingId);
  return selectedTrackingId ?? sendingNumbers?.[0]?.trackingId ?? null;
}
