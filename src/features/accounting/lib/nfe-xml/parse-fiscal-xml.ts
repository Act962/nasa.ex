import { XMLParser } from "fast-xml-parser";
import type { TaxRegimeCode } from "../tax/types";

// Leitor determinístico de XML de NF-e (modelo 55/65) e NFS-e Nacional,
// incluindo os grupos de IBS/CBS da NT 2025.002. Preferido à leitura por IA:
// XML é exato, e o crédito de tributo não pode depender de palpite.

export interface FiscalXmlItem {
  description: string;
  ncm: string | null;
  nbs: string | null;
  cfop: string | null;
  cst: string | null;
  cClassTrib: string | null;
  amountCents: number;
  ibsCents: number;
  cbsCents: number;
}

export interface FiscalXmlTaxes {
  icmsCents: number;
  ipiCents: number;
  pisCents: number;
  cofinsCents: number;
  issCents: number;
  ibsCents: number;
  cbsCents: number;
  isCents: number;
}

export interface FiscalXmlDocument {
  model: "NFE" | "NFSE";
  accessKey: string;
  number: string | null;
  series: string | null;
  issueDate: string | null;
  issuer: { document: string | null; name: string | null; taxRegime: TaxRegimeCode | null };
  recipient: { document: string | null; name: string | null };
  totalCents: number;
  taxes: FiscalXmlTaxes;
  items: FiscalXmlItem[];
  hasIbsCbsGroup: boolean;
}

export type ParseFiscalXmlResult =
  | { ok: true; document: FiscalXmlDocument }
  | { ok: false; reason: "invalid_xml" | "unsupported_document" };

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

export function parseFiscalXml(xmlText: string): ParseFiscalXmlResult {
  let root: XmlNode;
  try {
    root = parser.parse(xmlText) as XmlNode;
  } catch {
    return { ok: false, reason: "invalid_xml" };
  }

  const infNFe = findFirstNode(root, "infNFe");
  if (infNFe) return { ok: true, document: parseNfe(infNFe) };

  const infNFSe = findFirstNode(root, "infNFSe");
  if (infNFSe) return { ok: true, document: parseNfse(infNFSe, root) };

  return { ok: false, reason: "unsupported_document" };
}

function parseNfe(infNFe: XmlNode): FiscalXmlDocument {
  const idAttribute = readString(infNFe["@_Id"]);
  const accessKey = (idAttribute ?? "").replace(/^NFe/, "");
  const ide = asNode(infNFe.ide);
  const emit = asNode(infNFe.emit);
  const dest = asNode(infNFe.dest);
  const total = asNode(infNFe.total);
  const icmsTotal = asNode(total?.ICMSTot);
  const ibsCbsTotal = asNode(total?.IBSCBSTot);

  const items = asArray(infNFe.det).map((detail) => {
    const product = asNode(detail.prod);
    const tax = asNode(detail.imposto);
    const ibsCbs = asNode(tax?.IBSCBS);
    return {
      description: readString(product?.xProd) ?? "",
      ncm: readString(product?.NCM),
      nbs: null,
      cfop: readString(product?.CFOP),
      cst: readString(ibsCbs?.CST),
      cClassTrib: readString(ibsCbs?.cClassTrib),
      amountCents: toCents(product?.vProd),
      ibsCents: sumIbs(ibsCbs),
      cbsCents: toCents(findFirstValue(ibsCbs, "vCBS")),
    };
  });

  const ibsFromTotal = ibsCbsTotal ? sumIbs(ibsCbsTotal) : 0;
  const cbsFromTotal = ibsCbsTotal ? toCents(findFirstValue(ibsCbsTotal, "vCBS")) : 0;

  return {
    model: "NFE",
    accessKey,
    number: readString(ide?.nNF),
    series: readString(ide?.serie),
    issueDate: readString(ide?.dhEmi) ?? readString(ide?.dEmi),
    issuer: {
      document: readString(emit?.CNPJ) ?? readString(emit?.CPF),
      name: readString(emit?.xNome),
      taxRegime: mapCrtToRegime(readString(emit?.CRT)),
    },
    recipient: {
      document: readString(dest?.CNPJ) ?? readString(dest?.CPF),
      name: readString(dest?.xNome),
    },
    totalCents: toCents(icmsTotal?.vNF),
    taxes: {
      icmsCents: toCents(icmsTotal?.vICMS),
      ipiCents: toCents(icmsTotal?.vIPI),
      pisCents: toCents(icmsTotal?.vPIS),
      cofinsCents: toCents(icmsTotal?.vCOFINS),
      issCents: 0,
      ibsCents: ibsFromTotal || items.reduce((total, item) => total + item.ibsCents, 0),
      cbsCents: cbsFromTotal || items.reduce((total, item) => total + item.cbsCents, 0),
      isCents: toCents(findFirstValue(total, "vIS")),
    },
    items,
    hasIbsCbsGroup: Boolean(ibsCbsTotal) || items.some((item) => item.cClassTrib !== null),
  };
}

function parseNfse(infNFSe: XmlNode, root: XmlNode): FiscalXmlDocument {
  const idAttribute = readString(infNFSe["@_Id"]);
  const emit = asNode(infNFSe.emit);
  const values = asNode(infNFSe.valores);
  const dps = findFirstNode(root, "infDPS");
  const service = asNode(dps?.serv);
  const serviceCode = asNode(service?.cServ);
  const taker = asNode(dps?.toma);
  const dpsValues = asNode(dps?.valores);
  const serviceAmountCents = toCents(findFirstValue(dpsValues, "vServ"));
  const ibsCbs = findFirstNode(root, "IBSCBS") ?? findFirstNode(root, "gIBSCBS");

  const ibsCents = ibsCbs ? sumIbs(ibsCbs) : 0;
  const cbsCents = ibsCbs ? toCents(findFirstValue(ibsCbs, "vCBS")) : 0;

  return {
    model: "NFSE",
    accessKey: `NFSE-${(idAttribute ?? readString(infNFSe.nNFSe) ?? "").replace(/^NFS/, "")}`,
    number: readString(infNFSe.nNFSe),
    series: null,
    issueDate: readString(infNFSe.dhProc) ?? readString(dps?.dhEmi),
    issuer: {
      document: readString(emit?.CNPJ) ?? readString(emit?.CPF),
      name: readString(emit?.xNome),
      taxRegime: null,
    },
    recipient: {
      document: readString(taker?.CNPJ) ?? readString(taker?.CPF),
      name: readString(taker?.xNome),
    },
    totalCents: toCents(values?.vLiq) || serviceAmountCents,
    taxes: {
      icmsCents: 0,
      ipiCents: 0,
      pisCents: toCents(findFirstValue(dpsValues, "vPis")),
      cofinsCents: toCents(findFirstValue(dpsValues, "vCofins")),
      issCents: toCents(values?.vISSQN),
      ibsCents,
      cbsCents,
      isCents: 0,
    },
    items: [
      {
        description: readString(service?.xDescServ) ?? readString(serviceCode?.xDescServ) ?? "Serviço",
        ncm: null,
        nbs: readString(serviceCode?.cNBS),
        cfop: null,
        cst: readString(findFirstValue(ibsCbs, "CST")),
        cClassTrib: readString(findFirstValue(ibsCbs, "cClassTrib")),
        amountCents: serviceAmountCents,
        ibsCents,
        cbsCents,
      },
    ],
    hasIbsCbsGroup: Boolean(ibsCbs),
  };
}

/** IBS = parcela estadual + municipal quando o grupo vem separado. */
function sumIbs(node: XmlNode | null): number {
  if (!node) return 0;
  const consolidated = findFirstValue(node, "vIBS");
  if (consolidated !== null) return toCents(consolidated);
  return toCents(findFirstValue(node, "vIBSUF")) + toCents(findFirstValue(node, "vIBSMun"));
}

function mapCrtToRegime(crt: string | null): TaxRegimeCode | null {
  switch (crt) {
    case "1":
    case "2":
      return "SIMPLES";
    case "4":
      return "MEI";
    case "3":
      return "PRESUMIDO";
    default:
      return null;
  }
}

function findFirstNode(node: unknown, key: string): XmlNode | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirstNode(child, key);
      if (found) return found;
    }
    return null;
  }
  const record = node as XmlNode;
  if (key in record) {
    const value = record[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first && typeof first === "object") return first as XmlNode;
  }
  for (const child of Object.values(record)) {
    const found = findFirstNode(child, key);
    if (found) return found;
  }
  return null;
}

function findFirstValue(node: unknown, key: string): unknown {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirstValue(child, key);
      if (found !== null) return found;
    }
    return null;
  }
  const record = node as XmlNode;
  if (key in record && (typeof record[key] === "string" || typeof record[key] === "number")) {
    return record[key];
  }
  for (const child of Object.values(record)) {
    const found = findFirstValue(child, key);
    if (found !== null) return found;
  }
  return null;
}

function asNode(value: unknown): XmlNode | null {
  if (Array.isArray(value)) return asNode(value[0]);
  return value && typeof value === "object" ? (value as XmlNode) : null;
}

function asArray(value: unknown): XmlNode[] {
  if (Array.isArray(value)) return value.filter((item): item is XmlNode => Boolean(item) && typeof item === "object");
  const node = asNode(value);
  return node ? [node] : [];
}

function readString(value: unknown): string | null {
  if (typeof value === "string") return value.length > 0 ? value : null;
  if (typeof value === "number") return String(value);
  return null;
}

function toCents(value: unknown): number {
  const text = readString(value);
  if (!text) return 0;
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}
