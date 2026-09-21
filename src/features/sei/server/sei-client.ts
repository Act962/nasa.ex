import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { XMLParser } from "fast-xml-parser";

export type SeiConfig = {
  endpoint: string;
  siglaSistema: string;
  identificacaoServico: string;
  idUnidade: string;
};

type SoapValue = string | number | boolean | null | SoapValue[] | {
  [key: string]: SoapValue;
};

const parser = new XMLParser({
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  trimValues: true,
});

const PRIVATE_IPV4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
];

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return PRIVATE_IPV4.some((pattern) => pattern.test(address));
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
  }
  return true;
}

/**
 * Impede que a URL configurável vire um proxy SSRF. Instalações internas
 * precisam ter o host explicitamente listado em `SEI_ALLOWED_HOSTS`.
 */
export async function assertSafeSeiEndpoint(rawEndpoint: string): Promise<URL> {
  const endpoint = new URL(rawEndpoint);
  if (!["https:", "http:"].includes(endpoint.protocol)) {
    throw new Error("O endpoint do SEI deve usar HTTP ou HTTPS.");
  }
  if (endpoint.username || endpoint.password) {
    throw new Error("Não inclua usuário ou senha na URL do SEI.");
  }

  const allowedHosts = new Set(
    (process.env.SEI_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
  const hostAllowed = allowedHosts.has(endpoint.hostname.toLowerCase());
  const addresses = await lookup(endpoint.hostname, { all: true });

  if (!hostAllowed && addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error(
      "Host privado bloqueado. Adicione o domínio exato em SEI_ALLOWED_HOSTS para uma instalação acessada por VPN/rede interna.",
    );
  }
  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:" && !hostAllowed) {
    throw new Error("Em produção, o endpoint público do SEI deve usar HTTPS.");
  }
  return endpoint;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderParam(name: string, value: SoapValue): string {
  if (value === null) return `<${name} xsi:nil="true"/>`;
  if (Array.isArray(value)) {
    return `<${name}>${value.map((item) => renderParam("item", item)).join("")}</${name}>`;
  }
  if (typeof value === "object") {
    const children = Object.entries(value)
      .map(([key, child]) => renderParam(key, child))
      .join("");
    return `<${name}>${children}</${name}>`;
  }
  return `<${name} xsi:type="xsd:string">${escapeXml(String(value))}</${name}>`;
}

function buildEnvelope(operation: string, params: Record<string, SoapValue>): string {
  const body = Object.entries(params)
    .map(([name, value]) => renderParam(name, value))
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sei="Sei">
  <soapenv:Header/>
  <soapenv:Body>
    <sei:${operation} soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">${body}</sei:${operation}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function findDeep(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  if (key in value) return (value as Record<string, unknown>)[key];
  for (const child of Object.values(value as Record<string, unknown>)) {
    const found = findDeep(child, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (typeof value === "object" && "#text" in value) {
    return text((value as Record<string, unknown>)["#text"]);
  }
  return null;
}

function normalizeAccessLink(value: unknown, endpoint: string): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const link = new URL(raw, endpoint);
    return ["http:", "https:"].includes(link.protocol) ? link.toString() : null;
  } catch {
    return null;
  }
}

export class SeiSoapError extends Error {
  constructor(message: string, readonly operation: string) {
    super(message);
    this.name = "SeiSoapError";
  }
}

export async function callSei(
  config: SeiConfig,
  operation: string,
  params: Record<string, SoapValue>,
): Promise<Record<string, unknown>> {
  const endpoint = await assertSafeSeiEndpoint(config.endpoint);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=UTF-8",
        SOAPAction: "SeiAction",
      },
      body: buildEnvelope(operation, {
        SiglaSistema: config.siglaSistema,
        IdentificacaoServico: config.identificacaoServico,
        ...params,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const xml = await response.text();
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const fault = findDeep(parsed, "Fault");
    if (fault) {
      const faultMessage = text(findDeep(fault, "faultstring")) ?? "Falha retornada pelo SEI.";
      throw new SeiSoapError(faultMessage, operation);
    }
    if (!response.ok) {
      throw new SeiSoapError(`SEI respondeu HTTP ${response.status}.`, operation);
    }
    const parametros = findDeep(parsed, "parametros");
    if (parametros && typeof parametros === "object") {
      return parametros as Record<string, unknown>;
    }
    return { value: parametros ?? null };
  } catch (error) {
    if (error instanceof SeiSoapError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SeiSoapError("O SEI não respondeu em 30 segundos.", operation);
    }
    throw new SeiSoapError(
      error instanceof Error ? error.message : "Não foi possível acessar o SEI.",
      operation,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export type SeiProcessSnapshot = {
  protocolo: string;
  idProcedimento: string | null;
  especificacao: string | null;
  tipoProcedimento: string | null;
  nivelAcesso: string | null;
  ultimoAndamento: string | null;
  linkAcesso: string | null;
  raw: Record<string, unknown>;
};

export async function consultarProcedimento(
  config: SeiConfig,
  protocolo: string,
): Promise<SeiProcessSnapshot> {
  const raw = await callSei(config, "consultarProcedimento", {
    IdUnidade: config.idUnidade,
    ProtocoloProcedimento: protocolo,
    SinRetornarAssuntos: "N",
    SinRetornarInteressados: "N",
    SinRetornarObservacoes: "N",
    SinRetornarAndamentoGeracao: "N",
    SinRetornarAndamentoConclusao: "N",
    SinRetornarUltimoAndamento: "S",
    SinRetornarUnidadesProcedimentoAberto: "S",
    SinRetornarProcedimentosRelacionados: "N",
    SinRetornarProcedimentosAnexados: "N",
  });
  const tipo = findDeep(raw, "TipoProcedimento");
  const andamento = findDeep(raw, "UltimoAndamento");

  return {
    protocolo: text(findDeep(raw, "ProcedimentoFormatado")) ?? protocolo,
    idProcedimento: text(findDeep(raw, "IdProcedimento")),
    especificacao: text(findDeep(raw, "Especificacao")),
    tipoProcedimento:
      text(findDeep(tipo, "Nome")) ?? text(findDeep(tipo, "Descricao")) ?? text(tipo),
    nivelAcesso:
      text(findDeep(raw, "NivelAcessoLocal")) ?? text(findDeep(raw, "NivelAcessoGlobal")),
    ultimoAndamento:
      text(findDeep(andamento, "Descricao")) ?? text(findDeep(andamento, "DescricaoTarefa")),
    linkAcesso: normalizeAccessLink(
      findDeep(raw, "LinkAcesso") ?? findDeep(raw, "LinkAcessoExterno"),
      config.endpoint,
    ),
    raw,
  };
}

export async function listarUnidades(config: SeiConfig): Promise<Record<string, unknown>> {
  return callSei(config, "listarUnidades", {});
}
