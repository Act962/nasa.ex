// Opções de menu que o código responde sozinho, sem a assistente (spec 0102). O id da opção é o que
// liga o clique à resposta. Sem `server-only`: o editor de menus lê os rótulos daqui.

export const CAMPAIGN_OPTION_PREFIX = "camp:";
export const CAMPAIGN_OPTION = {
  start: "camp:start",
  accept: "camp:accept",
  refuse: "camp:refuse",
  newReceipt: "camp:new",
  points: "camp:points",
  codes: "camp:codes",
} as const;

export const STORE_INFO_PREFIX = "info:";
export const STORE_INFO_OPTION = { offers: "info:ofertas", instagram: "info:instagram", address: "info:endereco" } as const;

/** O que o dono do menu pode escolher para uma opção fazer ao ser clicada. */
export const CODED_MENU_ACTIONS: { id: string; label: string }[] = [
  { id: CAMPAIGN_OPTION.start, label: "Abrir a campanha de sorteio" },
  { id: STORE_INFO_OPTION.offers, label: "Enviar ofertas (stories)" },
  { id: STORE_INFO_OPTION.instagram, label: "Enviar o Instagram" },
  { id: STORE_INFO_OPTION.address, label: "Enviar o endereço" },
];

export function isCodedMenuAction(optionId: string): boolean {
  return CODED_MENU_ACTIONS.some((action) => action.id === optionId);
}
