// Clique no WhatsApp de uma página publicada vira visita `_evt:whatsapp_click` (spec 0114, RF-3): quando a
// primeira mensagem chega sem o código, a origem do lead sai pelo horário desse clique.
const REGISTER_VISIT_ENDPOINT = "/api/rpc/pages/registerVisit";

export function registerWhatsappClick(pageSlug: string): void {
  const body = JSON.stringify({ json: { slug: pageSlug, event: "whatsapp_click", userAgent: navigator.userAgent } });
  // sendBeacon sobrevive à troca de aba que o link do WhatsApp provoca.
  if ("sendBeacon" in navigator && navigator.sendBeacon(REGISTER_VISIT_ENDPOINT, new Blob([body], { type: "application/json" }))) {
    return;
  }
  fetch(REGISTER_VISIT_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(
    () => {},
  );
}
