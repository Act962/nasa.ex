import type { Metadata } from "next";
import { LegalPage } from "@/features/trafego/components/public/legal-page";

export const metadata: Metadata = {
  title: "Termos de Serviço — trafeGO",
  description: "Condições de contratação do serviço de gestão de tráfego trafeGO.",
};

export default function TrafegoTermsPage() {
  return (
    <LegalPage
      title="Termos de Serviço"
      updatedAt="30 de outubro de 2026"
      intro="Estes termos regem a contratação do trafeGO, serviço de gestão de tráfego pago e disparos operado pela Órbita. Ao contratar, você declara que leu e concorda com as condições abaixo — em especial as seções sobre criativos e resultados."
      sections={[
        {
          title: "O que está incluso",
          paragraphs: [
            "O trafeGO é um serviço de execução e gestão de campanhas. Nosso trabalho é configurar, publicar, monitorar e otimizar a veiculação dentro da plataforma escolhida (Meta, Google ou WhatsApp Oficial).",
          ],
          bullets: [
            "Configuração da campanha, segmentação e estrutura de anúncios",
            "Publicação e acompanhamento durante o período contratado",
            "Ajustes de otimização ao longo da veiculação",
            "Relatório de desempenho no painel do cliente",
            "Criação e configuração da conta de anúncios (BM), quando contratada",
            "Aquisição e configuração do número na API Oficial do WhatsApp, quando contratada",
            "Correção de problemas na conta de anúncios e criação da página do Facebook, como parte do setup",
          ],
        },
        {
          title: "Responsabilidade pelo criativo e pela copy",
          paragraphs: [
            "Os criativos (imagens e vídeos) e os textos veiculados são fornecidos por você, o contratante. A Órbita não produz, não revisa artisticamente e não garante o desempenho do material enviado.",
            "O desempenho de uma campanha depende de forma determinante da qualidade do criativo, da clareza da oferta, do preço praticado, da concorrência do seu mercado e da capacidade do seu negócio de atender a demanda gerada. Esses fatores estão fora do nosso controle.",
            "Em outras palavras: nosso compromisso é entregar a veiculação corretamente configurada e otimizada. Não nos responsabilizamos pelo resultado comercial de um criativo que não comunica bem, de uma oferta pouco competitiva ou de um atendimento que não converte os contatos gerados.",
            "Podemos apontar problemas evidentes no material e sugerir melhorias, mas a decisão final sobre o que será veiculado é sua.",
            "Nossa plataforma faz uma verificação prévia do conteúdo contra as políticas de publicidade da Meta, do Google e do WhatsApp, e sinaliza o que costuma ser recusado. Essa verificação é um auxílio, não uma garantia de aprovação: a responsabilidade pelo produto anunciado, pela oferta e pelas alegações feitas é integralmente do contratante. Anúncio recusado por política de plataforma não gera devolução da taxa de serviço.",
          ],
        },
        {
          title: "Ausência de garantia de resultado",
          paragraphs: [
            "Não garantimos número de vendas, de leads, de mensagens, faturamento, custo por resultado ou retorno sobre investimento. Qualquer projeção, estimativa ou exemplo apresentado tem caráter ilustrativo e não constitui promessa.",
            "Campanhas de tráfego pago envolvem leilão, sazonalidade e comportamento de audiência. Resultados obtidos por outros anunciantes não são indicativo do que você vai obter.",
          ],
        },
        {
          title: "Verba de tráfego e taxa de serviço",
          paragraphs: [
            "A verba de tráfego é paga por você diretamente à plataforma de anúncios (Meta ou Google), no meio de pagamento cadastrado na sua conta de anúncios. Ela não passa pela Órbita: o valor que você paga à Órbita é a taxa de serviço, o setup quando aplicável e os criativos extras.",
            "A taxa de serviço é de 30% sobre a verba declarada na contratação, com valor mínimo de R$ 150,00 por pedido. Se o gasto real da sua conta de anúncios no período do pedido passar da verba declarada, a Órbita cobra um complemento de 30% sobre a diferença. O gasto considerado é o da conta toda no período, exceto campanhas que a equipe identificar como não sendo do serviço trafeGO.",
            "O complemento é enviado por link de pagamento. Enquanto um complemento enviado estiver vencido e não pago, as funções de criar e publicar campanhas pelo painel ficam suspensas; as campanhas já publicadas na sua conta não são alteradas pela Órbita.",
            "A verba é consumida pela plataforma conforme a veiculação e a cobrança dela é entre você e a plataforma. A taxa de serviço remunera a execução e não é reembolsável depois que a campanha entra em análise pela equipe.",
            "O pagamento pode ser feito por cartão de crédito, com confirmação automática, ou por PIX. No PIX, o pagamento é conferido manualmente pela nossa equipe em horário comercial: a campanha só entra na fila depois dessa confirmação, e a cobrança tem validade informada no momento da contratação. Eventual reembolso de pagamento por PIX é feito para a mesma titularidade (CPF ou CNPJ) que originou a transferência.",
            "A taxa de setup é cobrada uma única vez por empresa. No tráfego pago, é de R$ 450,00 e cobre a configuração inicial feita pela nossa equipe: conectar a sua conta de anúncios à Órbita e conferir página, Instagram, conta de anúncios (BM) e parceria — criando a conta no seu nome quando você ainda não tem. Quem já pagou o setup em uma contratação anterior não paga de novo. No disparo por WhatsApp, cobre a aquisição do número e a habilitação dele na API Oficial da Meta.",
            "A produção de criativos (imagens, vídeos e artes) não está incluída na taxa de serviço nem no setup. É um serviço à parte, orçado sob demanda.",
          ],
        },
        {
          title: "Conta de anúncios e propriedade",
          paragraphs: [
            "Quando criamos a conta de anúncios (BM) para você, ela é registrada em seu nome e permanece sua, inclusive o histórico, os públicos e o aprendizado acumulado. Recebemos acesso de operação enquanto durar a prestação do serviço.",
            "Se você já possui conta própria, solicitaremos acesso. A responsabilidade por manter a conta em conformidade com as políticas da plataforma é do titular.",
          ],
        },
        {
          title: "Políticas das plataformas e reprovações",
          paragraphs: [
            "Meta, Google e WhatsApp têm políticas próprias de publicidade e podem reprovar anúncios, restringir contas ou suspender veiculações a seu exclusivo critério, sem aviso e sem justificativa detalhada.",
            "Reprovações causadas pelo conteúdo do material enviado — produto restrito, promessa proibida, imagem em desacordo com as regras — são de responsabilidade do contratante. Vamos apontar o motivo e orientar a correção, mas o tempo perdido e a verba já consumida não são reembolsáveis.",
          ],
        },
        {
          title: "Prazos",
          paragraphs: [
            "Após a confirmação do pagamento e o envio completo dos materiais, a equipe analisa o pedido e coloca a campanha no ar. O prazo depende da fila de execução, da aprovação da plataforma e da completude do material recebido.",
            "Materiais incompletos, fora de especificação ou que exijam correção suspendem a contagem até a regularização.",
            "A data realista de início apresentada na contratação, quando reconhecida pelo contratante, integra estes termos: ela considera o preparo da conta, a vinculação das redes e o envio dos materiais, e não constitui promessa de aprovação do anúncio pela plataforma.",
            "No disparo pela API Oficial do WhatsApp, o volume diário de envio é definido pela Meta e começa limitado em números novos, aumentando de forma progressiva conforme a qualidade das interações. Não é possível disparar para toda a base logo no primeiro envio, e esse ritmo não depende da Órbita.",
          ],
        },
        {
          title: "Cancelamento e reembolso",
          paragraphs: [
            "Antes de a campanha entrar em análise pela equipe, o cancelamento pode ser solicitado com reembolso da taxa de serviço.",
            "Depois que a campanha entra no ar, a taxa de serviço do período executado e os complementos sobre o gasto real não são reembolsáveis. A verba consumida é cobrada pela plataforma diretamente de você.",
            "O direito de arrependimento previsto no art. 49 do Código de Defesa do Consumidor é observado nos sete dias seguintes à contratação, desde que a execução ainda não tenha se iniciado.",
          ],
        },
        {
          title: "Suporte",
          paragraphs: [
            "O atendimento acontece pelo painel do cliente e pelos canais informados na contratação, em dias úteis. Pedidos que ampliem o escopo contratado podem ser orçados à parte.",
          ],
        },
        {
          title: "Alterações destes termos",
          paragraphs: [
            "Podemos revisar estes termos. A versão aceita no momento da sua contratação é a que vale para o seu pedido, e fica registrada junto com a data do aceite.",
          ],
        },
      ]}
    />
  );
}
