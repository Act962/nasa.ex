import "server-only";
import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";

// Leitura de endereço informado pelo usuário (spec 0088, S-5). Tudo que não for
// um site público em https é recusado antes de qualquer conexão.

export class UnsafeSiteAddressError extends Error {}

const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 127],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv6");
}

const IPV4_MAPPED_PREFIX = /^::ffff:/i;
const IPV4_MAPPED_IN_HEX = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;

/** "::ffff:10.0.0.1" e "::ffff:a00:1" são o mesmo IPv4 e têm de cair no mesmo filtro. */
function unmapIpv4(address: string): string {
  const inHex = address.match(IPV4_MAPPED_IN_HEX);
  if (inHex) {
    const high = parseInt(inHex[1], 16);
    const low = parseInt(inHex[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join(".");
  }
  return address.replace(IPV4_MAPPED_PREFIX, "");
}

export function isPublicAddress(address: string): boolean {
  const unmapped = unmapIpv4(address);
  const family = isIP(unmapped);
  if (family === 0) return false;
  return !blockedAddresses.check(unmapped, family === 4 ? "ipv4" : "ipv6");
}

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".test"];

/** Valida o formato: só https, porta padrão, nome de domínio (nunca IP), sem usuário e senha. */
export function parsePublicSiteUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new UnsafeSiteAddressError("invalid_url");
  }
  if (url.protocol !== "https:") throw new UnsafeSiteAddressError("not_https");
  if (url.port && url.port !== "443") throw new UnsafeSiteAddressError("custom_port");
  if (url.username || url.password) throw new UnsafeSiteAddressError("credentials_in_url");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isIP(hostname.replace(/^\[|\]$/g, "")) !== 0) throw new UnsafeSiteAddressError("ip_literal");
  if (!hostname.includes(".") || hostname === "localhost") throw new UnsafeSiteAddressError("local_host");
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new UnsafeSiteAddressError("local_host");
  }
  url.hash = "";
  return url;
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

/** Resolve o nome e só devolve um IP se TODOS os registros forem públicos. */
export async function resolvePublicAddress(hostname: string): Promise<ResolvedAddress> {
  const records = await lookup(hostname, { all: true }).catch(() => []);
  if (records.length === 0) throw new UnsafeSiteAddressError("dns_failed");
  if (records.some((record) => !isPublicAddress(record.address))) {
    throw new UnsafeSiteAddressError("private_address");
  }
  const preferred = records.find((record) => record.family === 4) ?? records[0];
  return { address: preferred.address, family: preferred.family === 6 ? 6 : 4 };
}

/** "www.clinica.com.br" e "clinica.com.br" são o mesmo site. */
export function siteKey(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}
