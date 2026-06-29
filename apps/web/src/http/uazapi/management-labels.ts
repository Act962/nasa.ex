"use server";
import { uazapiFetch } from "./client";
import { ManagementLabelsPayload, ManagementLabelsResponse } from "./types";

/**
 * Gerencia labels de um chat específico.
 *
 * Este endpoint oferece três modos de operação:
 * 1. Definir todas as labels (labelids): Substitui as existentes.
 * 2. Adicionar uma label (add_labelid): Adiciona sem afetar as existentes.
 * 3. Remover uma label (remove_labelid): Remove sem afetar as outras.
 *
 * Importante: Use apenas um dos três parâmetros por requisição.
 */
export async function managementLabels({
  token,
  data,
  baseUrl,
}: {
  token: string;
  data: ManagementLabelsPayload;
  baseUrl?: string;
}) {
  return await uazapiFetch<ManagementLabelsResponse>("/chat/labels", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
