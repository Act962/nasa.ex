export type NfsePrestador = {
  cnpj: string;
  inscricao_municipal: string;
  codigo_municipio: string;
};

export type NfseTomadorPJ = {
  cnpj: string;
  razao_social: string;
  email?: string;
  telefone?: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    codigo_municipio: string;
    uf: string;
    cep: string;
  };
};

export type NfseTomadorPF = {
  cpf: string;
  nome_completo: string;
  email?: string;
  telefone?: string;
};

export type NfseServico = {
  aliquota: number;
  iss_retido: boolean;
  item_lista_servico: string;
  discriminacao: string;
  codigo_municipio: string;
  valor_servicos: number;
  valor_iss?: number;
  deducoes?: number;
};

export type NfsePayload = {
  data_emissao: string;
  data_competencia?: string;
  natureza_operacao: number;
  optante_simples_nacional: boolean;
  regime_especial_tributacao?: number;
  prestador: NfsePrestador;
  tomador: NfseTomadorPJ | NfseTomadorPF;
  servico: NfseServico;
};

export type FocusNfseStatus =
  | "processando_autorizacao"
  | "autorizado"
  | "erro_autorizacao"
  | "cancelado";

export type FocusNfseResponse = {
  status: FocusNfseStatus;
  ref: string;
  numero?: string;
  codigo_verificacao?: string;
  url?: string;
  url_danfse?: string;
  caminho_xml_nota_fiscal?: string;
  mensagem_erro?: string;
  mensagem_erros?: string[];
  [key: string]: unknown;
};

export type FocusEmpresaResponse = {
  cnpj: string;
  nome: string;
  [key: string]: unknown;
};

export type FocusWebhookRegistration = {
  event: "nfse";
  url: string;
  authorization?: string;
};

export type FocusEmpresaPayload = {
  cnpj: string;
  nome: string;
  inscricao_municipal: string;
  regime_tributario: number;
  optante_simples_nacional: boolean;
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cep: string;
    codigo_municipio: string;
    uf: string;
  };
};
