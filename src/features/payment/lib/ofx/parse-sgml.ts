/**
 * Extrator de OFX SGML para objeto.
 *
 * Escrito à mão de propósito. As bibliotecas testadas normalizam a data no
 * momento do parse — `20260904000000[-3:BRT]` chega como `2026-09-04` e o
 * fuso se perde antes de qualquer opção de configuração. Como o deslocamento
 * de fuso é exatamente o erro que a conciliação não pode cometer, o arquivo
 * precisa chegar cru até os parsers deste diretório.
 *
 * O formato tem uma particularidade que separa um parser de OFX de um de XML:
 * tags de valor podem não ser fechadas. `<TRNAMT>100.00` seguido de outra tag
 * é válido e comum. Só tags de agrupamento têm fechamento garantido.
 */

export type SgmlNode = { [key: string]: string | SgmlNode | Array<string | SgmlNode> };

const TAG_PATTERN = /<(\/?)([A-Za-z0-9_.]+)>/g;

function appendValue(parent: SgmlNode, key: string, value: string | SgmlNode): void {
  const existing = parent[key];
  if (existing === undefined) {
    parent[key] = value;
    return;
  }
  // Repetição da mesma tag vira lista — é assim que STMTTRN aparece.
  if (Array.isArray(existing)) {
    existing.push(value);
    return;
  }
  parent[key] = [existing, value];
}

/** Separa o cabeçalho `CHAVE:VALOR` do corpo, que começa no primeiro `<`. */
export function splitOfxHeader(content: string): {
  header: Record<string, string>;
  body: string;
} {
  const bodyStart = content.indexOf("<");
  const rawHeader = bodyStart === -1 ? content : content.slice(0, bodyStart);
  const header: Record<string, string> = {};

  for (const line of rawHeader.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toUpperCase();
    if (key) header[key] = line.slice(separator + 1).trim();
  }

  return { header, body: bodyStart === -1 ? "" : content.slice(bodyStart) };
}

export function parseOfxSgml(content: string): SgmlNode {
  const { body } = splitOfxHeader(content);
  const root: SgmlNode = {};
  const stack: Array<{ tag: string; node: SgmlNode }> = [{ tag: "", node: root }];

  // Tag aberta aguardando valor: `<TRNAMT>` fica pendente até sabermos se o
  // que vem a seguir é texto (valor) ou outra tag (era agrupamento).
  let pending: string | null = null;
  let cursor = 0;
  let match: RegExpExecArray | null;

  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(body)) !== null) {
    const [, closing, rawTag] = match;
    const tag = rawTag.toUpperCase();
    const text = body.slice(cursor, match.index).trim();
    cursor = TAG_PATTERN.lastIndex;

    const current = stack[stack.length - 1].node;

    if (pending) {
      if (text) {
        // Texto entre a abertura e a próxima tag: é um valor escalar.
        appendValue(current, pending, text);
        pending = null;
      } else if (closing && tag === pending) {
        // `<FITID></FITID>`: tag fechada sem conteúdo. É um valor vazio, não um
        // agrupamento — o Banco do Brasil emite assim nas linhas de saldo, e
        // tratá-la como nó faria o campo chegar como objeto ao consumidor.
        appendValue(current, pending, "");
        pending = null;
        continue;
      } else {
        // Sem texto: a tag pendente era um agrupamento. Empilha.
        const child: SgmlNode = {};
        appendValue(current, pending, child);
        stack.push({ tag: pending, node: child });
        pending = null;
      }
    }

    if (closing) {
      // Fechamento de agrupamento. Fechamento de tag escalar (`</TRNAMT>` logo
      // após o valor) não encontra par na pilha e é ignorado de propósito.
      const openIndex = stack.map((frame) => frame.tag).lastIndexOf(tag);
      if (openIndex > 0) stack.length = openIndex;
      continue;
    }

    pending = tag;
  }

  // Última tag do arquivo com valor e sem fechamento.
  if (pending) {
    const trailing = body.slice(cursor).trim();
    if (trailing) appendValue(stack[stack.length - 1].node, pending, trailing);
  }

  return root;
}
