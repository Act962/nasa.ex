import type { Metadata } from "next";
import { LegalPage } from "@/features/trafego/components/public/legal-page";

export const metadata: Metadata = {
  title: "Política de Privacidade — trafeGO",
  description: "Como o trafeGO trata os dados pessoais dos seus clientes.",
};

export default function TrafegoPrivacyPage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      updatedAt="11 de setembro de 2026"
      intro="Esta política explica quais dados coletamos no trafeGO, por que coletamos e o que você pode exigir a respeito deles, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018)."
      sections={[
        {
          title: "Dados que coletamos",
          paragraphs: ["Coletamos apenas o necessário para prestar o serviço:"],
          bullets: [
            "Identificação e contato: nome, e-mail, telefone e nome da empresa",
            "Dados do negócio: ramo, público-alvo, site e informações do briefing",
            "Materiais enviados: criativos, textos e anexos da campanha",
            "Dados de pagamento: processados pelo Stripe — não armazenamos cartão",
            "Origem do acesso: parâmetros de campanha (UTM) e página de entrada",
            "Uso do painel: registros de acesso e ações, para segurança e suporte",
          ],
        },
        {
          title: "Para que usamos",
          paragraphs: [
            "Os dados são usados para executar a campanha contratada, manter seu painel, emitir cobrança, prestar suporte e cumprir obrigações legais e fiscais.",
            "Não vendemos seus dados e não os usamos para finalidade diferente da contratada sem avisar você antes.",
          ],
        },
        {
          title: "Compartilhamento",
          paragraphs: [
            "Compartilhamos dados apenas com quem é indispensável para o serviço funcionar:",
          ],
          bullets: [
            "Plataformas de anúncio (Meta, Google) — para veicular a campanha",
            "Stripe — para processar o pagamento",
            "Provedores de infraestrutura e e-mail — para hospedar o sistema e notificar você",
            "Autoridades públicas, quando houver obrigação legal",
          ],
        },
        {
          title: "Dados de terceiros que você nos envia",
          paragraphs: [
            "Em campanhas de disparo no WhatsApp, você pode nos enviar uma lista de contatos. Ao fazer isso, você declara que obteve esses dados licitamente e que possui base legal para comunicá-los — normalmente o consentimento do titular.",
            "A responsabilidade pela origem dessa lista é sua. Atuamos como operadores desses dados, tratando-os apenas conforme a sua instrução e pelo tempo da campanha.",
          ],
        },
        {
          title: "Por quanto tempo guardamos",
          paragraphs: [
            "Mantemos os dados enquanto durar a relação contratual e, depois, pelo prazo exigido pela legislação fiscal e para defesa em eventual processo. Criativos e materiais da campanha podem ser mantidos como registro do que foi veiculado.",
          ],
        },
        {
          title: "Seus direitos",
          paragraphs: [
            "A LGPD garante a você o direito de confirmar o tratamento, acessar os dados, corrigir dados incompletos ou desatualizados, solicitar anonimização ou eliminação, pedir portabilidade, revogar consentimento e se opor a tratamentos feitos sem base legal.",
            "Para exercer qualquer um deles, fale com a gente pelo painel ou pelo canal de atendimento. Respondemos em até 15 dias.",
          ],
        },
        {
          title: "Assistente virtual",
          paragraphs: [
            "A página do trafeGO oferece um assistente virtual (IA) para tirar dúvidas sobre o serviço. As mensagens trocadas com ele não são armazenadas por nós: são enviadas ao provedor de modelo de linguagem apenas para gerar a resposta e descartadas em seguida.",
            "Registramos somente o endereço IP da requisição, por tempo limitado e com a finalidade de limitar abuso. Não informe senhas nem dados de cartão nesse canal — ele não é o local de contratação.",
          ],
        },
        {
          title: "Segurança",
          paragraphs: [
            "Adotamos medidas técnicas e administrativas para proteger seus dados, incluindo controle de acesso, criptografia de credenciais e registro de atividades. Nenhum sistema é infalível: em caso de incidente relevante, comunicaremos você e a ANPD conforme a lei exige.",
          ],
        },
        {
          title: "Cookies",
          paragraphs: [
            "Usamos cookies para manter sua sessão ativa no painel e para identificar a origem do acesso (campanha, parceiro). Você pode bloqueá-los no navegador, mas o painel pode deixar de funcionar corretamente.",
          ],
        },
      ]}
    />
  );
}
