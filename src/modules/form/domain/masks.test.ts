import { describe, expect, it } from "vitest";
import {
  applyMask,
  BR_STATES,
  isValidByFormat,
  isValidCep,
  isValidCpf,
  isValidEmail,
  isValidPhoneBr,
  maskCep,
  maskCpf,
  maskPhoneBr,
} from "./masks";

describe("maskPhoneBr", () => {
  it.each([
    ["", ""],
    ["1", "(1"],
    ["11", "(11"],
    ["119", "(11) 9"],
    ["119123", "(11) 9123"],
    ["1191234", "(11) 9123-4"],
    ["1191234567", "(11) 9123-4567"],
    ["11912345678", "(11) 91234-5678"],
  ])("formata %j como %j", (raw, masked) => {
    expect(maskPhoneBr(raw)).toBe(masked);
  });

  it("ignora o que não é dígito e corta em 11 dígitos", () => {
    expect(maskPhoneBr("+11 (91234) 5678-999")).toBe("(11) 91234-5678");
  });
});

describe("isValidPhoneBr", () => {
  it("aceita 10 ou 11 dígitos, com ou sem máscara", () => {
    expect(isValidPhoneBr("(11) 9123-4567")).toBe(true);
    expect(isValidPhoneBr("11912345678")).toBe(true);
  });

  it("recusa 9 e 12 dígitos", () => {
    expect(isValidPhoneBr("119123456")).toBe(false);
    expect(isValidPhoneBr("551191234567")).toBe(false);
  });
});

describe("maskCpf", () => {
  it.each([
    ["", ""],
    ["123", "123"],
    ["1234", "123.4"],
    ["1234567", "123.456.7"],
    ["12345678901", "123.456.789-01"],
    ["123456789019999", "123.456.789-01"],
  ])("formata %j como %j", (raw, masked) => {
    expect(maskCpf(raw)).toBe(masked);
  });
});

describe("isValidCpf", () => {
  it("aceita CPF com dígitos verificadores corretos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("529.982.247-35")).toBe(false);
  });

  it("recusa sequência repetida, que passaria na conta", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("00000000000")).toBe(false);
  });

  it("recusa tamanho diferente de 11 dígitos", () => {
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });
});

describe("maskCep", () => {
  it.each([
    ["", ""],
    ["01310", "01310"],
    ["013101", "01310-1"],
    ["01310100", "01310-100"],
    ["013101009", "01310-100"],
  ])("formata %j como %j", (raw, masked) => {
    expect(maskCep(raw)).toBe(masked);
  });
});

describe("isValidCep", () => {
  it("aceita com ou sem hífen e ignora espaços", () => {
    expect(isValidCep("01310-100")).toBe(true);
    expect(isValidCep("01310100")).toBe(true);
    expect(isValidCep(" 01310 100 ")).toBe(true);
  });

  it("recusa hífen fora do lugar e tamanho errado", () => {
    expect(isValidCep("0131-0100")).toBe(false);
    expect(isValidCep("0131010")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("aceita endereço simples, ignorando espaços das pontas", () => {
    expect(isValidEmail("voce@exemplo.com")).toBe(true);
    expect(isValidEmail("  voce@exemplo.com  ")).toBe(true);
  });

  it("recusa sem domínio com ponto, sem arroba ou com espaço no meio", () => {
    expect(isValidEmail("voce@exemplo")).toBe(false);
    expect(isValidEmail("voce.exemplo.com")).toBe(false);
    expect(isValidEmail("vo ce@exemplo.com")).toBe(false);
  });
});

describe("applyMask", () => {
  it("delega para a máscara do formato", () => {
    expect(applyMask("phone-br", "11912345678")).toBe("(11) 91234-5678");
    expect(applyMask("cpf", "52998224725")).toBe("529.982.247-25");
    expect(applyMask("cep", "01310100")).toBe("01310-100");
  });

  it("não altera e-mail nem cidade", () => {
    expect(applyMask("email", " Voce@Exemplo.com ")).toBe(" Voce@Exemplo.com ");
    expect(applyMask("city-uf", "São Paulo - SP")).toBe("São Paulo - SP");
  });
});

describe("isValidByFormat", () => {
  it.each(["phone-br", "cpf", "cep", "city-uf", "email"] as const)(
    "recusa valor vazio em %s",
    (format) => {
      expect(isValidByFormat(format, "")).toBe(false);
    },
  );

  it("valida cada formato pela regra correspondente", () => {
    expect(isValidByFormat("phone-br", "(11) 91234-5678")).toBe(true);
    expect(isValidByFormat("cpf", "529.982.247-25")).toBe(true);
    expect(isValidByFormat("cep", "01310-100")).toBe(true);
    expect(isValidByFormat("email", "voce@exemplo.com")).toBe(true);
  });

  it("cidade exige o separador entre cidade e UF", () => {
    expect(isValidByFormat("city-uf", "São Paulo - SP")).toBe(true);
    expect(isValidByFormat("city-uf", "São Paulo")).toBe(false);
  });
});

describe("BR_STATES", () => {
  it("tem as 27 unidades federativas, sem repetição", () => {
    expect(BR_STATES).toHaveLength(27);
    expect(new Set(BR_STATES.map((state) => state.uf)).size).toBe(27);
  });
});
