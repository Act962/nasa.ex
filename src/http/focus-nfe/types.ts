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
  razao_social: string;
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
  natureza_operacao: string;
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

export type FocusNfseErro = {
  codigo: string;
  mensagem: string;
  correcao?: string;
};

export type FocusNfseResponse = {
  cnpj_prestador?: string;
  ref: string;
  numero_rps?: string;
  serie_rps?: string;
  tipo_rps?: string;
  status: FocusNfseStatus;
  numero?: string;
  codigo_verificacao?: string;
  data_emissao?: string;
  url?: string;
  url_danfse?: string;
  caminho_xml_nota_fiscal?: string;
  caminho_xml_cancelamento?: string;
  erros?: FocusNfseErro[];
  [key: string]: unknown;
};

export type FocusEmpresaResponse = {
  id: number;
  cnpj: string;
  nome: string;
  token_producao?: string | null;
  token_homologacao?: string | null;
  [key: string]: unknown;
};

export type FocusCancelResponse =
  | { status: "cancelado" }
  | { status: "erro_cancelamento"; erros: FocusNfseErro[] };

export type FocusWebhookRegistration = {
  event: "nfse";
  url: string;
  cnpj?: string;
  cpf?: string;
  authorization_header?: string;
  authorization?: string;
};

export type FocusHookResponse = {
  id: string;
  url: string;
  authorization: string | null;
  authorization_header: string | null;
  event: string;
  cnpj?: string;
  cpf?: string;
};

export type FocusMunicipioParams = {
  nome?: string;
  uf?: string;
  codigo_ibge?: string;
  habilita_nfse?: 1;
};

export type FocusMunicipio = {
  codigo_ibge: string;
  nome: string;
  uf: string;
  nome_uf?: string;
  codigo_uf?: string;
  habilita_nfse?: boolean;
};

export type FocusEmpresaPayload = {
  // Identificação
  nome: string;
  nome_fantasia?: string;
  cnpj?: string;
  cpf?: string;
  inscricao_estadual?: number;
  inscricao_municipal?: number;
  regime_tributario?: number;

  // Endereço
  logradouro?: string;
  numero?: number;
  complemento?: string;
  municipio?: string;
  bairro?: string;
  cep?: number;
  uf?: string;

  // Contato
  telefone?: string;
  email?: string;
  enviar_email_destinatario?: boolean;
  enviar_email_homologacao?: boolean;

  // Habilitações de documentos fiscais
  habilita_nfe?: boolean;
  habilita_nfce?: boolean;
  habilita_nfse?: boolean;
  habilita_nfsen_producao?: boolean;
  habilita_nfsen_homologacao?: boolean;
  habilita_cte?: boolean;
  habilita_mdfe?: boolean;
  habilita_manifestacao?: boolean;
  habilita_manifestacao_cte?: boolean;
  habilita_nfsen_recebidas_producao?: boolean;
  habilita_nfsen_recebidas_homologacao?: boolean;
  habilita_nfcom?: boolean;
  habilita_dce?: boolean;

  // Configurações de DANFE / impressão
  discrimina_impostos?: boolean;
  orientacao_danfe?: "portrait" | "landscape";
  recibo_danfe?: boolean;
  exibe_sempre_ipi_danfe?: boolean;
  exibe_issqn_danfe?: boolean;
  exibe_impostos_adicionais_danfe?: boolean;
  exibe_rastro_danfe?: boolean;
  exibe_unidade_tributaria_danfe?: boolean;
  exibe_sempre_volumes_danfe?: boolean;
  exibe_composicao_carga_mdfe?: boolean;
  mostrar_danfse_badge?: boolean;

  // NFCe
  habilita_contingencia_offline_nfce?: boolean;
  reaproveita_numero_nfce_contingencia?: boolean;
  csc_nfce_producao?: string;
  id_token_nfce_producao?: number;
  csc_nfce_homologacao?: string;
  id_token_nfce_homologacao?: number;

  // Certificado digital
  arquivo_certificado_base64?: string;
  senha_certificado?: string;
  arquivo_logo_base64?: string;
  delete_logo?: boolean;

  // Responsável / prefeitura
  nome_responsavel?: string;
  cpf_responsavel?: string;
  login_responsavel?: string;
  senha_responsavel?: string;
  cpf_cnpj_contabilidade?: string;

  // Datas de início de recebimento
  data_inicio_recebimento_nfe?: string;
  data_inicio_recebimento_cte?: string;

  // Séries e numeração — NFe
  proximo_numero_nfe_producao?: string;
  proximo_numero_nfe_homologacao?: string;
  serie_nfe_producao?: string;
  serie_nfe_homologacao?: string;

  // Séries e numeração — NFCe
  proximo_numero_nfce_producao?: string;
  proximo_numero_nfce_homologacao?: string;
  serie_nfce_producao?: string;
  serie_nfce_homologacao?: string;

  // Séries e numeração — NFSe
  proximo_numero_nfse_producao?: string;
  proximo_numero_nfse_homologacao?: string;
  serie_nfse_producao?: string;
  serie_nfse_homologacao?: string;

  // Séries e numeração — NFSe Nacional
  proximo_numero_nfsen_producao?: string;
  proximo_numero_nfsen_homologacao?: string;
  serie_nfsen_producao?: string;
  serie_nfsen_homologacao?: string;

  // Séries e numeração — CTe
  proximo_numero_cte_producao?: string;
  proximo_numero_cte_homologacao?: string;
  serie_cte_producao?: string;
  serie_cte_homologacao?: string;

  // Séries e numeração — CTeOS
  proximo_numero_cte_os_producao?: string;
  proximo_numero_cte_os_homologacao?: string;
  serie_cte_os_producao?: string;
  serie_cte_os_homologacao?: string;

  // Séries e numeração — MDFe
  proximo_numero_mdfe_producao?: string;
  proximo_numero_mdfe_homologacao?: string;
  serie_mdfe_producao?: string;
  serie_mdfe_homologacao?: string;

  // Séries e numeração — NFCom
  proximo_numero_nfcom_producao?: string;
  proximo_numero_nfcom_homologacao?: string;
  serie_nfcom_producao?: string;
  serie_nfcom_homologacao?: string;

  // Séries e numeração — DCE
  proximo_numero_dce_producao?: string;
  proximo_numero_dce_homologacao?: string;
  serie_dce_producao?: string;
  serie_dce_homologacao?: string;

  // Emissão síncrona
  nfe_sincrono?: boolean;
  nfe_sincrono_homologacao?: boolean;
  mdfe_sincrono?: boolean;
  mdfe_sincrono_homologacao?: boolean;

  // SMTP personalizado
  smtp_endereco?: string;
  smtp_dominio?: string;
  smtp_autenticacao?: "plain" | "login" | "cram_md5";
  smtp_porta?: number;
  smtp_login?: string;
  smtp_senha?: string;
  smtp_remetente?: string;
  smtp_responder_para?: string;
  smtp_modo_verificacao_openssl?: "peer" | "none";
  smtp_habilita_starttls?: boolean;
  smtp_ssl?: boolean;
  smtp_tls?: boolean;
};
