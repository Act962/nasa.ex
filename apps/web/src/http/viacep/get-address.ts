"use server";

import { viaCepFetch } from "./client";
import { ViaCepAddress, ViaCepError } from "./types";

type ViaCepResponse = ViaCepAddress | { erro: "true" };

export async function getAddressByCep(cep: string): Promise<ViaCepAddress> {
  const data = await viaCepFetch<ViaCepResponse>(cep);

  if ("erro" in data) {
    throw new ViaCepError(404, `CEP "${cep}" não encontrado`);
  }

  return data;
}
