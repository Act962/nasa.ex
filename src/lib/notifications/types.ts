/**
 * Portas (interfaces) da camada de notificações.
 *
 * Quem dispara depende destes contratos, nunca de um canal concreto (Web Push,
 * e-mail, WhatsApp...). Os adapters são plugados no composition root
 * (`src/lib/notifications/index.ts`). Acrescentar canal = registrar um adapter
 * lá, sem tocar em nenhum módulo que chama `notificationService.send`.
 *
 * Mesmo desenho de `src/lib/realtime/types.ts`.
 */

/** Conteúdo da notificação. Genérico de propósito: não cita caso de uso. */
export interface NotificationContent {
  title: string;
  body: string;
  /** Para onde levar no clique. Caminho relativo ou URL absoluta. */
  url?: string | null;
  /** Agrupa notificações do mesmo assunto: a nova substitui a anterior. */
  tag?: string | null;
  icon?: string | null;
  /** Carga livre que o consumidor lê no clique. Não use para dado sensível. */
  data?: Record<string, unknown>;
}

export interface NotificationInput {
  /** Destinatários. Resolver endereço é responsabilidade de cada canal. */
  userIds: string[];
  notification: NotificationContent;
  /**
   * Canais a usar. Omitido = todos os disponíveis no composition root.
   * Um canal indisponível (sem credencial) devolve `skipped`, não erro.
   */
  channels?: NotificationChannelName[];
}

export type NotificationChannelName = "web-push";

export interface NotificationChannelResult {
  channel: NotificationChannelName;
  /** Entregas aceitas pelo destino. */
  sent: number;
  /** Destinos que recusaram. Inclui os removidos por estarem mortos. */
  failed: number;
  /** Canal sem credencial ou sem destinatário: não tentou. */
  skipped: boolean;
  reason?: string;
}

export interface NotificationResult {
  results: NotificationChannelResult[];
}

/**
 * Um meio de entrega. Implementar esta interface é tudo o que um canal novo
 * precisa fazer para ficar disponível ao sistema inteiro.
 */
export interface NotificationChannel {
  readonly name: NotificationChannelName;
  /** false quando falta credencial — o serviço pula sem tratar como erro. */
  isAvailable(): boolean;
  send(input: NotificationInput): Promise<NotificationChannelResult>;
}

/** O que qualquer módulo consome. */
export interface NotificationService {
  send(input: NotificationInput): Promise<NotificationResult>;
}
