/**
 * Converte um arquivo OFX no `NormalizedStatement` que a conciliação consome.
 *
 * Toda a leitura do arquivo passa pelos parsers deste diretório: o SGML vira
 * objeto em `parse-sgml`, e valor, data e contraparte têm cada um sua função.
 * Nenhuma biblioteca externa toca no arquivo — as testadas normalizavam a data
 * no parse e descartavam o fuso, que é o dado que a conciliação não pode perder.
 *
 * Três desvios de formato, todos observados em extratos reais, moram aqui:
 *  - O Sicoob emite `<STMTTRN>` **sem `<DTPOSTED>`**, contra a especificação.
 *  - O Banco do Brasil injeta pseudo-lançamentos de saldo ("Saldo Anterior",
 *    "Saldo do dia") com `<FITID>` vazio, que não são movimentação.
 *  - O Banco do Brasil repete o mesmo `<FITID>` em transações distintas, o que
 *    impede usá-lo sozinho como chave de idempotência.
 */

import type {
  NormalizedBankTransaction,
  NormalizedStatement,
  StatementSource,
  StatementWarning,
} from "../../server/statements/ports";
import { parseOfxAmountToCents } from "./parse-amount";
import { parseOfxSgml, splitOfxHeader, type SgmlNode } from "./parse-sgml";
import { parseOfxDate } from "./parse-ofx-date";
import { parsePaymentMemo } from "./parse-memo";

type RawRecord = Record<string, unknown>;

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  // Um nó aninhado nunca é um valor de campo; sem esta guarda um campo
  // inesperadamente estruturado viraria a string "[object Object]".
  if (typeof value === "object") return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function pick(source: unknown, ...path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as RawRecord)[key];
  }
  return current;
}

/**
 * Sem FITID não há como reconhecer a mesma transação numa reimportação. O id
 * sintético mantém o arquivo utilizável, mas é frágil: qualquer mudança no
 * texto do lançamento gera um id novo e a transação duplica. Por isso vem
 * acompanhado de aviso.
 */
/**
 * Linha de saldo disfarçada de transação. O BB abre e fecha cada dia com
 * "Saldo Anterior"/"Saldo do dia" dentro de `<STMTTRN>`, sem FITID — importar
 * isso somaria o saldo ao movimento e estouraria a conciliação. Chegou a 36%
 * dos blocos num extrato PJ real.
 */
function isBalancePseudoEntry(fitId: string | null, label: string): boolean {
  if (fitId) return false;
  return /^\s*saldo\b/i.test(label);
}

/** Data a partir do FITID sintético do Sicoob, que começa com AAAAMMDD. */
function dateFromFitIdPrefix(fitId: string): string | null {
  const match = /^(\d{8})/.exec(fitId);
  return match ? match[1] : null;
}

function syntheticId(parts: Array<string | number | null>): string {
  const seed = parts.map((part) => String(part ?? "")).join("|");
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return `syn:${Math.abs(hash).toString(36)}:${seed.length}`;
}

export function parseOfxStatement(
  content: string,
  source: StatementSource = "OFX_UPLOAD",
): NormalizedStatement {
  const warnings: StatementWarning[] = [];

  const tree = parseOfxSgml(content) as unknown as RawRecord;
  const statement =
    pick(tree, "OFX", "BANKMSGSRSV1", "STMTTRNRS", "STMTRS") ??
    // Alguns bancos emitem o extrato sem o envelope de mensagens.
    pick(tree, "OFX", "STMTRS");

  if (!statement) {
    throw new Error(
      "Arquivo OFX sem bloco de extrato bancário (BANKMSGSRSV1). Confira se o arquivo é o extrato da conta, e não a fatura do cartão.",
    );
  }

  const transactionList = pick(statement, "BANKTRANLIST");
  const rawTransactions = pick(transactionList, "STMTTRN") ?? [];
  const entries = (
    Array.isArray(rawTransactions) ? rawTransactions : [rawTransactions]
  ).filter((item): item is RawRecord => Boolean(item) && typeof item === "object");

  // Data de fechamento do extrato: último recurso quando o banco omite
  // `<DTPOSTED>` na transação.
  const listEndRaw = asText(pick(transactionList, "DTEND"));

  const occurrences = new Map<string, number>();
  const transactions: NormalizedBankTransaction[] = [];
  let skippedBalanceRows = 0;
  let reusedFitIds = 0;

  entries.forEach((raw, index) => {
    const name = asText(raw.NAME);
    const memo = asText(raw.MEMO) ?? name ?? "Sem descrição";
    const amountRaw = asText(raw.TRNAMT);
    // Whitespace interno acontece quando o banco quebra a linha dentro da tag;
    // o identificador precisa ser estável byte a byte entre importações.
    const fitId = asText(raw.FITID)?.replace(/\s+/g, "") ?? null;

    if (isBalancePseudoEntry(fitId, name ?? memo)) {
      skippedBalanceRows++;
      return;
    }

    if (!amountRaw) {
      warnings.push({
        code: "INVALID_TRANSACTION",
        message: `Transação ${index + 1} ignorada: sem valor.`,
        severity: "error",
      });
      return;
    }

    // DTPOSTED → DTEND do bloco → prefixo do FITID sintético.
    const postedRaw =
      asText(raw.DTPOSTED) ??
      listEndRaw ??
      (fitId ? dateFromFitIdPrefix(fitId) : null);

    if (!postedRaw) {
      warnings.push({
        code: "INVALID_TRANSACTION",
        message: `Transação ${index + 1} ignorada: o arquivo não traz data nem no lançamento nem no período.`,
        severity: "error",
      });
      return;
    }

    const parsedDate = parseOfxDate(postedRaw);
    const cents = parseOfxAmountToCents(amountRaw);

    if (!parsedDate || cents === null) {
      warnings.push({
        code: "INVALID_TRANSACTION",
        message: `Transação ${index + 1} ignorada: data "${postedRaw}" ou valor "${amountRaw}" em formato não reconhecido.`,
        severity: "error",
      });
      return;
    }

    let externalId: string;
    if (!fitId) {
      externalId = syntheticId([postedRaw, amountRaw, memo, index]);
      warnings.push({
        code: "MISSING_FITID",
        message:
          "Este extrato tem transações sem identificador do banco. Foi gerado um id próprio, então reimportar o mesmo período pode duplicar lançamentos.",
        severity: "warning",
      });
    } else {
      // O BB repete o mesmo FITID em transações distintas — de valores e datas
      // diferentes. Tratar a repetição como duplicata descartaria movimento
      // legítimo, então cada reaparição ganha um sufixo posicional, estável
      // enquanto a ordem do extrato for estável.
      const seenSoFar = occurrences.get(fitId) ?? 0;
      occurrences.set(fitId, seenSoFar + 1);
      externalId = seenSoFar === 0 ? fitId : `${fitId}#${seenSoFar + 1}`;
      if (seenSoFar > 0) reusedFitIds++;
    }

    const memoInfo = parsePaymentMemo(memo);
    // O sinal do TRNAMT é a fonte da verdade; TRNTYPE é só um rótulo e alguns
    // bancos o preenchem de forma inconsistente.
    const direction = cents < 0 ? "DEBIT" : "CREDIT";

    transactions.push({
      externalId,
      direction,
      amountCents: Math.abs(cents),
      postedAt: parsedDate.postedAt,
      postedDate: parsedDate.postedDate,
      memo,
      memoKind: memoInfo.memoKind,
      counterpartyName: memoInfo.counterpartyName,
      counterpartyDocument: memoInfo.counterpartyDocument,
      counterpartyDocumentMasked: memoInfo.counterpartyDocumentMasked,
      raw: raw as Record<string, unknown>,
    });
  });

  if (reusedFitIds > 0) {
    warnings.push({
      code: "REUSED_FITID",
      message: `${reusedFitIds} transação(ões) compartilham o identificador de outra no mesmo extrato — comum no Banco do Brasil. Foram importadas com um sufixo próprio para não se perderem.`,
      severity: "info",
    });
  }
  if (skippedBalanceRows > 0) {
    warnings.push({
      code: "BALANCE_ROWS_SKIPPED",
      message: `${skippedBalanceRows} linha(s) de saldo do extrato foram ignoradas por não serem movimentação.`,
      severity: "info",
    });
  }

  const ledgerAmount = asText(pick(statement, "LEDGERBAL", "BALAMT"));
  const ledgerAt = asText(pick(statement, "LEDGERBAL", "DTASOF"));

  return {
    source,
    bankId: asText(pick(statement, "BANKACCTFROM", "BANKID")),
    accountId: asText(pick(statement, "BANKACCTFROM", "ACCTID")),
    currency: asText(pick(statement, "CURDEF")),
    periodStart: parseOfxDate(asText(pick(transactionList, "DTSTART")) ?? "")?.postedDate ?? null,
    periodEnd: parseOfxDate(asText(pick(transactionList, "DTEND")) ?? "")?.postedDate ?? null,
    ledgerBalanceCents: ledgerAmount ? parseOfxAmountToCents(ledgerAmount) : null,
    ledgerBalanceAt: ledgerAt ? (parseOfxDate(ledgerAt)?.postedAt ?? null) : null,
    transactions,
    warnings,
  };
}
