// Etapa "Cartão" do assistente (spec 0040, RF-3): os passos de pagamento do guia,
// cada um com o print da Meta e o destaque vermelho no que clicar.

import { GUIDE_STEPS, WHATSAPP_GUIDE } from "../../lib/whatsapp-connect-guide";
import { GuideShot } from "@/features/meta-guide/components/guide-shot";
import { InstructionChecklist } from "@/features/meta-guide/components/instruction-checklist";
import { type ChecklistItem } from "./guided-checklist";

const PAYMENT_ALERT_STEP = GUIDE_STEPS.find((step) => step.slug === "aviso-pagamento");
const PAYMENT_SETTINGS_STEP = GUIDE_STEPS.find((step) => step.slug === "contas-whatsapp");
const CARD_FLOW_STEPS = ["contas-whatsapp", "pagamento-adicionar", "pagamento-fuso"]
  .map((slug) => GUIDE_STEPS.find((step) => step.slug === slug))
  .filter((step): step is NonNullable<typeof step> => Boolean(step));
const WHATSAPP_ACCOUNTS_URL = PAYMENT_SETTINGS_STEP?.link ?? "https://business.facebook.com/latest/settings/whatsapp_account";

export function buildCardChecklist(params: { paymentMethodsUrl: string }): ChecklistItem[] {
  return [
    {
      id: "open-billing",
      title: "Abra as contas do WhatsApp na Meta",
      summary: (
        <p>
          A Meta cobra as mensagens <strong>direto no cartão da sua empresa</strong>, todo mês. Sem cartão cadastrado, as campanhas
          não saem. A ÓRBITA não vê nem guarda os dados do cartão.
        </p>
      ),
      links: [
        { label: "Abrir contas do WhatsApp", href: WHATSAPP_ACCOUNTS_URL, isPrimary: true },
        { label: "Pagamentos da Meta", href: params.paymentMethodsUrl },
      ],
      howTo: PAYMENT_ALERT_STEP ? (
        <div className="space-y-2">
          <InstructionChecklist instruction={PAYMENT_ALERT_STEP.instruction} />
          <GuideShot step={PAYMENT_ALERT_STEP} imageBasePath={WHATSAPP_GUIDE.imageBasePath} />
        </div>
      ) : undefined,
      doneLabel: "Abri",
    },
    {
      id: "add-card",
      title: "Adicione o cartão da empresa",
      summary: <p>Crédito ou débito com função crédito. Prefira o cartão da empresa (CNPJ).</p>,
      howTo: (
        <ol className="space-y-4">
          {CARD_FLOW_STEPS.map((step, index) => (
            <li key={step.slug} className="space-y-2">
              <p className="text-sm font-medium">
                {index + 1}. {step.title}
              </p>
              <InstructionChecklist instruction={step.instruction} />
              {step.tip && (
                <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300">{step.tip}</p>
              )}
              <GuideShot step={step} imageBasePath={WHATSAPP_GUIDE.imageBasePath} />
            </li>
          ))}
        </ol>
      ),
      isHowToOpen: true,
      doneLabel: "Cartão cadastrado",
    },
  ];
}
