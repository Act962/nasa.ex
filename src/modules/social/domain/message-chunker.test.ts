import { describe, expect, it } from "vitest";
import {
  countChars,
  limitForMessage,
  MAX_BUTTON_TEMPLATE_CHARS,
  MAX_MESSAGE_CHARS,
  planMessageChunks,
  splitTextByChars,
  truncateToChars,
} from "./message-chunker";

const wordsOfFiveChars = (count: number) => "abcd ".repeat(count).trim();

describe("countChars", () => {
  it("conta emoji e letra acentuada como um caractere", () => {
    expect(countChars("🙂")).toBe(1);
    expect(countChars("ação")).toBe(4);
  });
});

describe("limitForMessage", () => {
  it("mensagem com botão tem limite menor", () => {
    expect(limitForMessage(false)).toBe(1000);
    expect(limitForMessage(true)).toBe(640);
  });
});

describe("splitTextByChars", () => {
  it("texto vazio não gera bloco", () => {
    expect(splitTextByChars("")).toEqual([]);
  });

  it("texto dentro do limite volta inteiro, sem aparar", () => {
    expect(splitTextByChars(" oi ", 10)).toEqual([" oi "]);
  });

  it("corta em espaço, sem partir palavra", () => {
    expect(splitTextByChars("aaa bbb ccc", 7)).toEqual(["aaa bbb", "ccc"]);
  });

  it("palavra maior que o limite é partida por caractere", () => {
    expect(splitTextByChars("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("não parte emoji ao meio", () => {
    expect(splitTextByChars("🙂🙂🙂", 2)).toEqual(["🙂🙂", "🙂"]);
  });
});

describe("truncateToChars", () => {
  it("corta por caractere, não por unidade UTF-16", () => {
    expect(truncateToChars("🙂🙂🙂", 2)).toBe("🙂🙂");
    expect(truncateToChars("oi", 5)).toBe("oi");
  });
});

describe("planMessageChunks", () => {
  it("sem botão, todo bloco respeita 1000 caracteres e nada se perde", () => {
    const text = wordsOfFiveChars(340);

    const chunks = planMessageChunks(text, false);

    expect(chunks.length).toBe(2);
    for (const chunk of chunks) expect(countChars(chunk)).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
    expect(chunks.join(" ")).toBe(text);
  });

  it("com botão, só o último trecho é reduzido ao limite do template", () => {
    const text = wordsOfFiveChars(340);

    const chunks = planMessageChunks(text, true);

    expect(chunks.length).toBe(3);
    expect(countChars(chunks[0])).toBeGreaterThan(MAX_BUTTON_TEMPLATE_CHARS);
    expect(countChars(chunks[0])).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
    for (const chunk of chunks.slice(1)) {
      expect(countChars(chunk)).toBeLessThanOrEqual(MAX_BUTTON_TEMPLATE_CHARS);
    }
    expect(chunks.join(" ")).toBe(text);
  });

  it("com botão, mensagem única acima de 640 é dividida", () => {
    const text = wordsOfFiveChars(150);

    const chunks = planMessageChunks(text, true);

    expect(chunks.length).toBe(2);
    for (const chunk of chunks) {
      expect(countChars(chunk)).toBeLessThanOrEqual(MAX_BUTTON_TEMPLATE_CHARS);
    }
    expect(chunks.join(" ")).toBe(text);
  });

  it("com botão e último bloco já dentro do limite, nada muda", () => {
    const text = wordsOfFiveChars(100);

    expect(planMessageChunks(text, true)).toEqual([text]);
  });

  it("texto vazio não gera bloco, com ou sem botão", () => {
    expect(planMessageChunks("", true)).toEqual([]);
    expect(planMessageChunks("", false)).toEqual([]);
  });
});
