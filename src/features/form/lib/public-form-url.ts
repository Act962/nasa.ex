// Endereço público de um formulário para o cliente preencher (spec 0100, RF-1).
// `/submit-form/<formId>` é a única rota aberta; o `leadToken` só preenche nome, e-mail e telefone.

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
}

export function buildPublicFormUrl(params: { formId: string; leadPublicToken?: string | null }): string {
  const url = `${appBaseUrl()}/submit-form/${params.formId}`;
  return params.leadPublicToken ? `${url}?leadToken=${encodeURIComponent(params.leadPublicToken)}` : url;
}
