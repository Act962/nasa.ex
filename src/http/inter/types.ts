// Contratos da API PJ do Banco Inter (spec 0130). Segue o padrão do Bacen para PIX
// (`/pix/v2`), com os nomes de campo do Inter.

export type InterEnv = "production" | "sandbox";

/** Certificado e chave PEM da integração, já decifrados, só em memória. */
export interface InterMtlsCredentials {
  env: InterEnv;
  certificatePem: string;
  privateKeyPem: string;
}

export interface InterAppCredentials extends InterMtlsCredentials {
  clientId: string;
  clientSecret: string;
}

/** Credenciais de uma chamada autenticada: mTLS + token + conta. */
export interface InterCallContext extends InterMtlsCredentials {
  accessToken: string;
  /** Só números com dígito, sem zero à esquerda (`x-conta-corrente`). */
  accountNumber?: string | null;
  timeoutMs?: number;
}

export interface InterTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export type InterCobvStatus =
  | "ATIVA"
  | "CONCLUIDA"
  | "REMOVIDA_PELO_USUARIO_RECEBEDOR"
  | "REMOVIDA_PELO_PSP";

export type InterDebtor =
  | { cpf: string; nome: string }
  | { cnpj: string; nome: string };

export interface InterCobvInput {
  calendario: { dataDeVencimento: string; validadeAposVencimento?: number };
  devedor?: InterDebtor;
  /** Valor em reais com duas casas, como texto ("123.45"). */
  valor: { original: string };
  chave: string;
  solicitacaoPagador?: string;
}

export interface InterCobv {
  txid: string;
  revisao: number;
  status: InterCobvStatus;
  calendario: { criacao: string; dataDeVencimento: string; validadeAposVencimento?: number };
  valor: { original: string };
  chave: string;
  loc?: { id: number; location: string; tipoCob: string };
  /** Copia e cola (BR Code). A amostra da documentação omite, mas o Inter devolve. */
  pixCopiaECola?: string;
}

export interface InterPixReceived {
  endToEndId: string;
  txid?: string;
  /** Reais com duas casas, como texto. */
  valor: string;
  chave?: string;
  horario: string;
  /** Texto livre digitado pelo pagador — não é nome nem documento. */
  infoPagador?: string;
  pagador?: { cpf?: string; cnpj?: string; nome?: string };
  devolucoes?: Array<{ id: string; valor: string; status: string }>;
}

export interface InterPixListResponse {
  parametros: { inicio: string; fim: string; paginacao: { paginaAtual: number; itensPorPagina: number; quantidadeDePaginas?: number; quantidadeTotalDeItens?: number } };
  pix: InterPixReceived[];
}

/** Corpo do aviso de PIX recebido. Um aviso pode trazer vários PIX. */
export interface InterPixWebhookPayload {
  pix: InterPixReceived[];
}

export interface InterWebhookConfig {
  webhookUrl: string;
  chave: string;
  criacao: string;
}

/** Corpo de erro no formato `application/problem+json` do Bacen. */
export interface InterProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  violacoes?: Array<{ razao?: string; propriedade?: string; valor?: string }>;
}
