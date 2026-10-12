import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

/** Teste do atendimento pela tela de configuração (spec 0089): não envia nada ao WhatsApp nem grava dados. */
export function useSendAttendanceTest() {
  return useMutation(orpc.ia.attendanceTest.send.mutationOptions());
}
