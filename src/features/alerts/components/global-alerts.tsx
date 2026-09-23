"use client";

import { authClient } from "@/lib/auth-client";
import { AlertProvider } from "./alert-provider";

/**
 * Monta o `AlertProvider` uma vez, no layout raiz, para o popup seguir a
 * pessoa por toda a aplicação — antes ele vivia só em `/admin` e em
 * `(platform)/(tracking)`, então um admin em qualquer outra tela não recebia
 * aviso nenhum (spec 0021, D-6).
 *
 * Sem sessão não monta: em página pública isso evitaria abrir canal do Pusher
 * e buscar críticos pendentes para visitante anônimo. Como o provider é irmão
 * da árvore e não a envolve, ligá-lo depois do login não remonta o app.
 */
export function GlobalAlerts() {
  const { data: session } = authClient.useSession();
  if (!session?.user) return null;
  return <AlertProvider />;
}
