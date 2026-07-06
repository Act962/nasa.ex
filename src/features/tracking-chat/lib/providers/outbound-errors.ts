import "server-only";

/**
 * Erros estruturados do caminho de envio outbound (Fase 6 — Roadmap
 * WhatsApp Oficial).
 *
 * Por que tipos próprios em vez de só `Error("...")`:
 *  - O frontend precisa distinguir "instância não existe" (mostrar
 *    convite pra configurar QR/credenciais) de "Meta não suporta essa
 *    feature" (mostrar mensagem diferente, eventualmente desabilitar o
 *    botão) de erro genérico (toast vermelho).
 *  - O `chargeMessageOutbound` cobra ★ ANTES do send. Se o erro for
 *    `META_FEATURE_UNSUPPORTED` queremos sinalizar pro caller estornar a
 *    cobrança — `instanceof MetaFeatureUnsupportedError` deixa explícito.
 *
 * Cada subclasse expõe `code` (string semântica) e os campos relevantes.
 * Os handlers em `router/message/*` mapeiam pra `errors.BAD_REQUEST` do
 * oRPC com `data.code` setado pro frontend tratar.
 */

/** Base — facilita `instanceof` cross-classes. */
export class OutboundProviderError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
  }
}

/**
 * Lançado quando o `trackingId` não tem `WhatsAppInstance` configurada.
 * Frontend mostra "Configure uma instância em Configurações → WhatsApp".
 */
export class InstanceNotFoundError extends OutboundProviderError {
  readonly trackingId: string;
  constructor(trackingId: string) {
    super(
      "INSTANCE_NOT_FOUND",
      `Nenhuma instância WhatsApp configurada para este tracking. Acesse Configurações → WhatsApp pra ligar uma.`,
    );
    this.trackingId = trackingId;
  }
}

/**
 * Lançado quando provider=META_CLOUD mas alguma credencial obrigatória
 * está faltando (UI gate da Fase 5 cobre o fluxo normal — esse erro só
 * acontece se o admin removeu credencial sem voltar pra UAZAPI).
 */
export class MetaCredentialsIncompleteError extends OutboundProviderError {
  readonly fields: readonly string[];
  constructor(fields: readonly string[]) {
    super(
      "META_CREDENTIALS_INCOMPLETE",
      `Credenciais Meta incompletas (${fields.join(", ")}). Reconfigure em Configurações → WhatsApp → Provider.`,
    );
    this.fields = fields;
  }
}

/**
 * Lançado quando o provider externo (Meta/Uazapi/...) retornou 200 mas
 * o corpo da resposta NÃO contém o `externalMessageId` esperado.
 *
 * Cenários:
 *  - Meta retorna `{ messages: [] }` em soft-fail / rate-limit (raro mas
 *    documentado);
 *  - Uazapi retorna sem `id` em casos de timeout interno;
 *  - Resposta com shape inesperado.
 *
 * Diferente de erros de configuração (`InstanceNotFoundError`,
 * `MetaCredentialsIncompleteError`), este é uma falha **transitória do
 * provedor** — caller pode mostrar "tente novamente em alguns segundos"
 * e o frontend NÃO deve desabilitar a UI.
 *
 * Importante: jogar este erro impede que `Message.messageId` receba
 * string vazia, o que violaria `@unique` no próximo send (re-entrega na
 * mesma instância) ou faria deletes/edits por `messageId === ""`
 * atingirem mensagens erradas.
 */
export class ProviderSendInvalidResponseError extends OutboundProviderError {
  readonly providerId: string;
  readonly operation: string;
  constructor(providerId: string, operation: string, detail?: string) {
    super(
      "PROVIDER_SEND_INVALID_RESPONSE",
      `Provider ${providerId} respondeu 200 mas sem ID da mensagem em ${operation}. Provável soft-fail/rate-limit — mensagem NÃO foi entregue.${
        detail ? ` ${detail}` : ""
      }`,
    );
    this.providerId = providerId;
    this.operation = operation;
  }
}

/**
 * Lançado quando o usuário tenta usar uma feature que a Meta Cloud API
 * não suporta no caminho outbound:
 *
 *  - **Edit message**: Meta não tem endpoint pra editar mensagem outbound.
 *  - **Delete message**: Meta não tem endpoint pra deletar mensagem
 *    outbound (só recebe revoke via webhook).
 *  - **Buttons interativos**: exigem template HSM aprovado; o `sendButtons`
 *    Uazapi não tem equivalente direto na Cloud API.
 *
 * Frontend pode usar o `feature` pra mostrar mensagem específica e/ou
 * desabilitar preventivamente (followup #10).
 */
export class MetaFeatureUnsupportedError extends OutboundProviderError {
  readonly feature: "edit" | "delete" | "buttons";
  constructor(feature: "edit" | "delete" | "buttons") {
    const map = {
      edit: "Editar mensagem não é suportado na Meta Cloud API. A mensagem original permanece intacta.",
      delete:
        "Apagar mensagem não é suportado na Meta Cloud API. O destinatário continuará vendo a mensagem.",
      buttons:
        "Botões interativos exigem template HSM aprovado na Meta — não disponível nesse fluxo. Envie como texto.",
    } as const;
    super("META_FEATURE_UNSUPPORTED", map[feature]);
    this.feature = feature;
  }
}

/**
 * Inverso do `MetaFeatureUnsupportedError`: lançado quando a feature só
 * existe num provider e o ativo é outro. O primeiro caso é **template HSM**,
 * que é conceito exclusivo da Meta Cloud API — `UazapiProvider.sendTemplate`
 * lança isso. Mantemos genérico (`feature: string`) pra cobrir futuros casos.
 */
export class ProviderFeatureUnsupportedError extends OutboundProviderError {
  readonly providerId: string;
  readonly feature: string;
  constructor(providerId: string, feature: string) {
    super(
      "PROVIDER_FEATURE_UNSUPPORTED",
      `O provider ativo (${providerId}) não suporta "${feature}". Templates HSM exigem a API Oficial (Meta Cloud).`,
    );
    this.providerId = providerId;
    this.feature = feature;
  }
}

/**
 * Lançado quando a Meta recusa o envio porque a **janela de 24h** de
 * atendimento fechou (a última mensagem do lead foi há mais de 24h). Códigos
 * Meta: `131047` (re-engagement) / `131051` (unsupported message type fora da
 * janela). Texto livre/mídia só são aceitos dentro da janela — fora dela é
 * preciso enviar um template aprovado.
 *
 * Defense-in-depth: a UI já bloqueia o composer fora da janela
 * (`useCustomerWindow`), mas a janela pode fechar entre o fetch e o envio.
 * Frontend trata o `code` mostrando CTA de template.
 */
export class OutboundWindowClosedError extends OutboundProviderError {
  constructor(detail?: string) {
    super(
      "META_WINDOW_CLOSED",
      `A janela de 24h de atendimento da Meta fechou. Envie um template aprovado pra reabrir a conversa.${
        detail ? ` ${detail}` : ""
      }`,
    );
  }
}
