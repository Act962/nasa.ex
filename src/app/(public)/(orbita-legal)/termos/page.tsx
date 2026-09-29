import type { Metadata } from "next";
import { OrbitaLegalPage } from "@/features/legal/components/orbita-legal-page";
import { ORBITA_CONTACT_EMAIL } from "@/features/legal/lib/orbita-legal";
import { listPublishedApps } from "@/features/legal/lib/orbita-data-inventory";

export const metadata: Metadata = {
  title: "Termos de Uso — Órbita Hub",
  description: "Regras de uso da plataforma Órbita Hub.",
};

export default function OrbitaTermsPage() {
  const publishedApps = listPublishedApps();

  return (
    <OrbitaLegalPage
      title="Termos de Uso"
      intro="Estes termos regem o uso do Órbita Hub. Ao criar uma conta ou usar a plataforma, você concorda com eles e com a Política de Privacidade."
      sections={[
        {
          title: "O serviço",
          paragraphs: [
            "O Órbita Hub é uma plataforma on-line de gestão comercial, contratada por assinatura. A lista de apps abaixo acompanha o catálogo publicado na plataforma; a disponibilidade de cada app depende do plano contratado.",
          ],
          bullets: publishedApps.map((app) => `${app.name}: ${app.description}`),
        },
        {
          title: "Conta e acesso",
          paragraphs: [
            "Você é responsável pelas informações da sua conta, pela guarda da senha e por tudo o que for feito com o seu acesso. Administradores da organização definem quem entra e o que cada membro pode fazer.",
            "Avise-nos imediatamente se suspeitar de uso não autorizado da sua conta.",
          ],
        },
        {
          title: "Planos, pagamentos e Stars",
          paragraphs: [
            "Os preços e limites de cada plano são apresentados no momento da contratação. A assinatura é renovada automaticamente até ser cancelada.",
            "Stars são créditos de uso da plataforma (por exemplo, para funções de IA). Não são moeda, não rendem juros e só podem ser usados dentro do Órbita.",
          ],
        },
        {
          title: "Uso aceitável",
          paragraphs: ["Não é permitido usar a plataforma para:"],
          bullets: [
            "Enviar spam ou mensagens a contatos sem base legal para isso",
            "Violar políticas do WhatsApp, Meta ou de outros serviços integrados",
            "Publicar conteúdo ilegal, enganoso, discriminatório ou que viole direitos de terceiros",
            "Tentar acessar dados de outras organizações ou burlar limites e controles de segurança",
            "Revender ou redistribuir a plataforma sem autorização",
          ],
        },
        {
          title: "Seus dados e conteúdo",
          paragraphs: [
            "O conteúdo que você cadastra continua sendo seu. Você nos autoriza a tratá-lo apenas para prestar o serviço, conforme a Política de Privacidade.",
            "Você é responsável pela origem lícita dos dados de leads e clientes que coloca na plataforma e pelo atendimento aos pedidos dos titulares desses dados.",
          ],
        },
        {
          title: "Inteligência artificial",
          paragraphs: [
            "Respostas do ASTRO e de outras funções de IA são geradas automaticamente e podem conter erros. Revise antes de enviar a clientes ou tomar decisões com base nelas. Ações que alteram dados pedem sua confirmação.",
          ],
        },
        {
          title: "Integrações de terceiros",
          paragraphs: [
            "Integrações como WhatsApp, Instagram, meios de pagamento e calendários dependem dos respectivos fornecedores. Mudanças, bloqueios ou indisponibilidades nesses serviços podem afetar o funcionamento no Órbita e fogem do nosso controle.",
          ],
        },
        {
          title: "Disponibilidade e mudanças no produto",
          paragraphs: [
            "Trabalhamos para manter a plataforma disponível, mas podem ocorrer interrupções para manutenção ou por falhas. Apps e funções podem ser incluídos, alterados ou descontinuados; mudanças que afetem o que você contratou serão avisadas com antecedência.",
          ],
        },
        {
          title: "Suspensão e cancelamento",
          paragraphs: [
            "Você pode cancelar a assinatura a qualquer momento. Podemos suspender ou encerrar contas que violem estes termos ou deixem de pagar, após aviso, salvo em casos graves que exijam ação imediata.",
            "Após o cancelamento, você pode solicitar uma cópia dos seus dados; depois, eles são excluídos ou anonimizados conforme a Política de Privacidade.",
          ],
        },
        {
          title: "Responsabilidade",
          paragraphs: [
            "O Órbita é uma ferramenta: os resultados comerciais dependem do seu uso. Não respondemos por danos indiretos ou lucros cessantes, nem por conteúdo publicado pelos usuários, respeitados os direitos garantidos pelo Código de Defesa do Consumidor quando aplicável.",
          ],
        },
        {
          title: "Alterações destes termos",
          paragraphs: [
            "A lista de apps destes termos é atualizada automaticamente quando o catálogo muda, e a data no topo acompanha essas mudanças. Alterações nas regras em si serão avisadas na plataforma ou por e-mail antes de entrar em vigor.",
            "Estes termos seguem a legislação brasileira.",
            `Dúvidas: ${ORBITA_CONTACT_EMAIL}.`,
          ],
        },
      ]}
    />
  );
}
