/**
 * Helpers pro campo "Endereço" do evento — aceita texto livre OU URL
 * do Google Maps, e gera src de iframe pra embedar mapa.
 *
 * Por que aceitar URL? O user disse que quer poder colar o link do
 * Google Maps (mais preciso pra pinos exatos, salas de evento etc) em
 * vez de digitar o endereço completo. Mantém compatibilidade com
 * endereços em texto puro que já existem no banco.
 */

const GOOGLE_MAPS_HOSTS = [
  "google.com/maps",
  "www.google.com/maps",
  "maps.google.com",
  "goo.gl/maps",
  "maps.app.goo.gl",
];

/**
 * Detecta se um valor é uma URL do Google Maps (qualquer subdomínio
 * comum). Aceita http/https e short links.
 */
export function isGoogleMapsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  if (!/^https?:\/\//.test(v)) return false;
  return GOOGLE_MAPS_HOSTS.some((host) => v.includes(host));
}

/**
 * Gera a URL `src` pra `<iframe>` que renderiza o mapa.
 *
 *  - Se for URL do Google Maps: passa o link como `q=<URL>` no embed.
 *    O Google interpreta como busca e renderiza a localização daquela
 *    URL (funciona pra short links `goo.gl`/`maps.app.goo.gl` também,
 *    diferente de `&output=embed` direto que requer expansão).
 *  - Se for texto livre: usa como `q=<texto>` (busca por endereço).
 *
 * Usa o endpoint sem API key (`maps.google.com/maps?q=...&output=embed`).
 * Funciona pra eventos públicos sem precisar configurar Maps Platform.
 *
 * Retorna `null` se o input for vazio.
 */
export function getMapEmbedUrl(
  addressOrUrl: string | null | undefined,
): string | null {
  if (!addressOrUrl) return null;
  const cleaned = addressOrUrl.trim();
  if (!cleaned) return null;
  const q = encodeURIComponent(cleaned);
  return `https://maps.google.com/maps?q=${q}&output=embed`;
}

/**
 * Devolve um texto curto pra exibir como label do endereço quando o
 * input é uma URL longa do Google Maps (que ninguém quer ver inteira
 * no card). Pra endereços em texto, devolve o próprio texto.
 */
export function getMapDisplayLabel(
  addressOrUrl: string | null | undefined,
): string {
  if (!addressOrUrl) return "";
  const v = addressOrUrl.trim();
  if (!v) return "";
  if (isGoogleMapsUrl(v)) return "Ver no Google Maps";
  return v;
}
