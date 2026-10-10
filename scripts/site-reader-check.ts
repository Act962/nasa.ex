// Confere a leitura segura de sites (spec 0088, CA-8). Rodar:
//   pnpm tsx --conditions=react-server scripts/site-reader-check.ts [url]
import { fetchPublicPage } from "../src/features/tracking-chat-ai/lib/site-reader/fetch-page";
import { readSite } from "../src/features/tracking-chat-ai/lib/site-reader/read-site";
import { isPublicAddress } from "../src/features/tracking-chat-ai/lib/site-reader/safe-address";

const REFUSED_URLS = [
  "http://example.com",
  "https://localhost",
  "https://localhost:3000/api",
  "https://10.0.0.1",
  "https://169.254.169.254/latest/meta-data",
  "https://[::1]/",
  "https://user:pass@example.com",
  "https://example.com:8443",
  "https://intranet",
  "https://app.internal/x",
  // Nomes públicos que resolvem para endereço interno.
  "https://127.0.0.1.nip.io",
  "https://10.0.0.1.nip.io",
  "https://169.254.169.254.nip.io",
  "ftp://example.com",
  "file:///etc/passwd",
];

async function main() {
  let failures = 0;
  for (const refusedUrl of REFUSED_URLS) {
    const outcome = await fetchPublicPage(refusedUrl).then(
      () => "LEU",
      (error: Error) => `${error.constructor.name}:${error.message}`,
    );
    const isRefused = outcome.startsWith("UnsafeSiteAddressError");
    if (!isRefused) failures += 1;
    console.log(`${isRefused ? "ok  " : "FALHA"} CA-8 ${refusedUrl} → ${outcome}`);
  }
  for (const [address, expected] of [["8.8.8.8", true], ["172.20.1.1", false], ["::ffff:10.0.0.1", false], ["::ffff:a00:1", false], ["::ffff:808:808", true], ["1.1.1.1", true], ["fd00::1", false], ["2606:4700::1111", true]] as const) {
    const isPublic = isPublicAddress(address);
    if (isPublic !== expected) failures += 1;
    console.log(`${isPublic === expected ? "ok  " : "FALHA"} endereço ${address} público=${isPublic}`);
  }
  const siteUrl = process.argv[2];
  if (siteUrl) {
    const site = await readSite(siteUrl);
    for (const page of site.pages) console.log(`página ${page.url} · "${page.title}" · ${page.text.length} caracteres`);
  }
  console.log(failures === 0 ? "TUDO CERTO" : `${failures} FALHA(S)`);
  process.exit(failures === 0 ? 0 : 1);
}
void main();
