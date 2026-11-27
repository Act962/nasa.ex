// Aviso do ganhador pelo WhatsApp (spec 0148): o que entra em cada variável {{n}} do modelo aprovado.
// Puro: a janela usa para a prévia e o servidor para montar o envio, com o mesmo resultado.

export const WINNER_VARIABLE_SOURCES = ["full_name", "first_name", "code", "prize", "position", "campaign", "fixed"] as const;

export type WinnerVariableSource = (typeof WINNER_VARIABLE_SOURCES)[number];

export type WinnerVariable = { source: WinnerVariableSource; fixedText?: string };

export type NoticeWinner = { position: number; code: string; name: string };

export const WINNER_VARIABLE_LABELS: Record<WinnerVariableSource, string> = {
  full_name: "Nome do ganhador",
  first_name: "Primeiro nome",
  code: "Número da sorte",
  prize: "Prêmio da posição",
  position: "Posição (1º, 2º…)",
  campaign: "Nome da campanha",
  fixed: "Texto fixo",
};

export function prizeNameAt(prizeNames: string[], position: number): string {
  return prizeNames[position - 1]?.trim() ?? "";
}

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function winnerVariableValues(params: {
  variables: WinnerVariable[];
  winner: NoticeWinner;
  campaignName: string;
  prizeNames: string[];
}): string[] {
  return params.variables.map((variable) => {
    switch (variable.source) {
      case "full_name":
        return params.winner.name.trim();
      case "first_name":
        return firstNameOf(params.winner.name);
      case "code":
        return params.winner.code;
      case "prize":
        return prizeNameAt(params.prizeNames, params.winner.position);
      case "position":
        return `${params.winner.position}º`;
      case "campaign":
        return params.campaignName;
      case "fixed":
        return variable.fixedText?.trim() ?? "";
    }
  });
}

export function renderTemplateBody(bodyText: string, values: string[]): string {
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (placeholder, index: string) => values[Number(index) - 1] ?? placeholder);
}

/** Posições que usariam "prêmio" sem nome: a Meta recusa variável vazia, e o ganhador receberia "seu prêmio é ". */
export function positionsMissingPrize(params: { variables: WinnerVariable[]; winners: NoticeWinner[]; prizeNames: string[] }): number[] {
  if (!params.variables.some((variable) => variable.source === "prize")) return [];
  return params.winners.filter((winner) => !prizeNameAt(params.prizeNames, winner.position)).map((winner) => winner.position);
}

export function hasEmptyFixedText(variables: WinnerVariable[]): boolean {
  return variables.some((variable) => variable.source === "fixed" && !variable.fixedText?.trim());
}
