/**
 * Bancos brasileiros por código COMPE.
 *
 * O código é o mesmo que o extrato OFX traz em `<BANKID>`, então preencher
 * `bankCode` ao cadastrar a conta é o que permite reconhecer de qual conta o
 * arquivo importado veio.
 *
 * Lista dos que uma PME usa na prática, não o cadastro completo do BCB — quem
 * precisar de um fora dela digita o nome à mão.
 */

export interface BankOption {
  /** Código COMPE, com três dígitos. */
  code: string;
  name: string;
  /** Apelidos pelos quais as pessoas procuram o banco. */
  aliases?: string[];
}

export const BRAZILIAN_BANKS: BankOption[] = [
  { code: "001", name: "Banco do Brasil", aliases: ["bb"] },
  { code: "003", name: "Banco da Amazônia", aliases: ["basa"] },
  { code: "004", name: "Banco do Nordeste", aliases: ["bnb"] },
  { code: "021", name: "Banestes" },
  { code: "025", name: "Banco Alfa" },
  { code: "033", name: "Santander" },
  { code: "037", name: "Banpará" },
  { code: "041", name: "Banrisul" },
  { code: "047", name: "Banese" },
  { code: "070", name: "BRB — Banco de Brasília" },
  { code: "077", name: "Banco Inter", aliases: ["inter"] },
  { code: "082", name: "Banco Topázio" },
  { code: "084", name: "Uniprime Norte do Paraná" },
  { code: "085", name: "Ailos", aliases: ["cecred", "viacredi"] },
  { code: "089", name: "Cresol Central SC/RS" },
  { code: "097", name: "Credisis" },
  { code: "099", name: "Uniprime Central" },
  { code: "104", name: "Caixa Econômica Federal", aliases: ["caixa", "cef"] },
  { code: "121", name: "Banco Agibank" },
  { code: "133", name: "Cresol", aliases: ["cresol"] },
  { code: "136", name: "Unicred" },
  { code: "197", name: "Stone", aliases: ["stone pagamentos"] },
  { code: "208", name: "BTG Pactual", aliases: ["btg"] },
  { code: "212", name: "Banco Original" },
  { code: "218", name: "Banco BS2" },
  { code: "237", name: "Bradesco" },
  { code: "246", name: "Banco ABC Brasil" },
  { code: "260", name: "Nubank", aliases: ["nu pagamentos", "nu"] },
  { code: "290", name: "PagBank", aliases: ["pagseguro"] },
  { code: "301", name: "BPP / Dock" },
  { code: "318", name: "Banco BMG" },
  { code: "323", name: "Mercado Pago", aliases: ["mercadopago"] },
  { code: "329", name: "QI Sociedade de Crédito" },
  { code: "335", name: "Banco Digio" },
  { code: "336", name: "Banco C6", aliases: ["c6 bank", "c6"] },
  { code: "341", name: "Itaú Unibanco", aliases: ["itau"] },
  { code: "348", name: "Banco XP", aliases: ["xp"] },
  { code: "364", name: "Efí", aliases: ["gerencianet", "efi bank"] },
  { code: "376", name: "J.P. Morgan" },
  { code: "380", name: "PicPay" },
  { code: "389", name: "Banco Mercantil do Brasil" },
  { code: "403", name: "Cora", aliases: ["cora scd"] },
  { code: "422", name: "Banco Safra", aliases: ["safra"] },
  { code: "436", name: "Banco Neon", aliases: ["neon"] },
  { code: "461", name: "Asaas", aliases: ["asaas ip"] },
  { code: "462", name: "Stark Bank" },
  { code: "473", name: "Banco Caixa Geral" },
  { code: "536", name: "Banco Neon (Neon Pagamentos)" },
  { code: "600", name: "Banco Luso Brasileiro" },
  { code: "604", name: "Banco Industrial do Brasil" },
  { code: "610", name: "Banco VR" },
  { code: "611", name: "Banco Paulista" },
  { code: "613", name: "Banco Omni" },
  { code: "623", name: "Banco Pan", aliases: ["pan"] },
  { code: "630", name: "Banco Smartbank" },
  { code: "633", name: "Banco Rendimento" },
  { code: "637", name: "Banco Sofisa", aliases: ["sofisa"] },
  { code: "643", name: "Banco Pine" },
  { code: "654", name: "Banco Digimais" },
  { code: "655", name: "Banco Votorantim", aliases: ["bv"] },
  { code: "707", name: "Banco Daycoval", aliases: ["daycoval"] },
  { code: "712", name: "Banco Ourinvest" },
  { code: "739", name: "Banco Cetelem" },
  { code: "743", name: "Banco Semear" },
  { code: "745", name: "Citibank", aliases: ["citi"] },
  { code: "746", name: "Banco Modal" },
  { code: "748", name: "Sicredi", aliases: ["sicredi"] },
  { code: "752", name: "BNP Paribas Brasil" },
  { code: "755", name: "Bank of America Merrill Lynch" },
  { code: "756", name: "Sicoob", aliases: ["bancoob", "banco cooperativo do brasil"] },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Busca por código ou por nome/apelido, sem acento e sem diferenciar caixa.
 *
 * O resultado vem ordenado por relevância: quem casa o código exato antes de
 * quem casa o começo do nome, e este antes de quem só contém o termo no meio.
 * Sem isso, procurar "c6" traz primeiro os bancos cujo *código* tem um 6.
 */
export function searchBanks(query: string): BankOption[] {
  const term = normalize(query);
  if (!term) return BRAZILIAN_BANKS;

  // Só trata como código quando o termo é numérico: em "c6" o 6 é parte do
  // nome, não um código a procurar.
  const isNumericTerm = /^\d+$/.test(term);
  const codeTerm = isNumericTerm ? String(Number(term)) : null;

  const scored = BRAZILIAN_BANKS.map((bank) => {
    const name = normalize(bank.name);
    const aliases = (bank.aliases ?? []).map(normalize);
    const bareCode = String(Number(bank.code));

    let rank = -1;
    if (codeTerm && bareCode === codeTerm) rank = 0;
    else if (codeTerm && bank.code.startsWith(term)) rank = 1;
    else if (name.startsWith(term)) rank = 2;
    else if (aliases.some((alias) => alias === term)) rank = 2;
    else if (aliases.some((alias) => alias.startsWith(term))) rank = 3;
    else if (name.includes(term)) rank = 4;
    else if (aliases.some((alias) => alias.includes(term))) rank = 5;
    else if (codeTerm && bank.code.includes(codeTerm)) rank = 6;

    return { bank, rank };
  })
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.bank.code.localeCompare(b.bank.code));

  return scored.map((entry) => entry.bank);
}

/**
 * Resolve o banco a partir do código.
 *
 * Compara sem zeros à esquerda porque as fontes divergem: o OFX do Nubank traz
 * `<BANKID>0260</BANKID>` com quatro dígitos, o do Banco do Brasil traz `1` com
 * um só, e o cadastro guarda três.
 */
export function findBankByCode(code: string | null | undefined): BankOption | null {
  if (!code) return null;
  const digits = code.replace(/\D/g, "");
  if (!digits) return null;
  const bare = String(Number(digits));
  return BRAZILIAN_BANKS.find((bank) => String(Number(bank.code)) === bare) ?? null;
}
