import type { Metadata } from "next";
import { PushTestPanel } from "@/features/notifications/components/push-test-panel";

export const metadata: Metadata = {
  title: "Teste de notificação",
  robots: { index: false, follow: false },
};

/**
 * Página de diagnóstico do Web Push (spec 0022).
 *
 * Existe para separar as três etapas que falham por motivos diferentes:
 * exibir notificação local, criar inscrição e entregar push pelo servidor.
 */
export default function PushTestPage() {
  return <PushTestPanel />;
}
