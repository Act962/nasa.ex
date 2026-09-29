"use server";

import { graphFetch } from "./client";

// Cadastra o número na conta WhatsApp (WABA) — o que o cliente faria em
// "Adicionar telefone" no painel da Meta (spec 0040, RF-12).

interface AddPhoneNumberInput {
  wabaId: string;
  accessToken: string;
  /** Código do país sem "+", ex.: "55". */
  countryCode: string;
  /** Número nacional só com dígitos, ex.: "11952133700". */
  phoneNumber: string;
  /** Nome que o cliente final vê (sujeito à revisão da Meta). */
  verifiedName: string;
}

export async function addPhoneNumber(input: AddPhoneNumberInput): Promise<{ id: string }> {
  return graphFetch<{ id: string }>(`/${input.wabaId}/phone_numbers`, {
    method: "POST",
    accessToken: input.accessToken,
    body: { cc: input.countryCode, phone_number: input.phoneNumber, verified_name: input.verifiedName },
  });
}
