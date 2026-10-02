// Termos técnicos da Meta explicados em linguagem simples: viram um ⓘ clicável no texto do guia.

export interface GuideGlossaryTerm {
  id: string;
  /** Como o termo aparece no texto (sem diferenciar maiúsculas). O primeiro achado ganha o ⓘ. */
  matches: string[];
  title: string;
  text: string;
}

export const GUIDE_GLOSSARY: GuideGlossaryTerm[] = [
  {
    id: "chat-orbita",
    matches: ["Chat da ÓRBITA"],
    title: "Chat da ÓRBITA",
    text: "Onde chegam todas as conversas do seu WhatsApp oficial. A equipe atende junto, cada contato vira lead no funil, o Astro responde e qualifica, e responder em até 24h é grátis.",
  },
  {
    id: "conexao-meta",
    matches: ["conexão na Meta", "conexão nova", "conexão que você criou", "conexão"],
    title: "Conexão na Meta",
    text: "É um cadastro técnico que a Meta exige para ligar o seu WhatsApp à ÓRBITA. Lá na Meta ele aparece com o nome de “app” ou “aplicativo”, mas não é a ÓRBITA nem um aplicativo de celular — ninguém precisa baixar nada.",
  },
  {
    id: "outra-ferramenta",
    matches: ["outra ferramenta de atendimento", "outra ferramenta"],
    title: "Por que trazer para a ÓRBITA?",
    text: "No Chat da ÓRBITA a equipe toda atende o mesmo número, cada conversa vira lead no funil e o Astro responde e qualifica por você. Tudo num lugar só, sem pagar outra ferramenta.",
  },
  {
    id: "portfolio",
    matches: ["portfólio"],
    title: "Portfólio empresarial",
    text: "É o cadastro da sua empresa dentro da Meta (antigo Gerenciador de Negócios). Ele junta a Página, o Instagram, as contas do WhatsApp e quem pode mexer em cada um.",
  },
  {
    id: "conta-whatsapp",
    matches: ["conta do WhatsApp Business", "Contas do WhatsApp", "conta do WhatsApp"],
    title: "Conta do WhatsApp Business",
    text: "É onde a Meta guarda o seu número oficial, o nome que os clientes veem e o cartão que paga as mensagens. Uma empresa pode ter mais de uma.",
  },
  {
    id: "usuario-sistema",
    matches: ["usuário do sistema", "Usuários do sistema"],
    title: "Usuário do sistema",
    text: "Um “robô” da sua empresa na Meta. Ele mantém a ÓRBITA conectada mesmo se a pessoa que fez a configuração trocar a senha ou sair da empresa.",
  },
  {
    id: "ativos",
    matches: ["Atribuir ativos", "ativo"],
    title: "Ativos",
    text: "É como a Meta chama tudo que a empresa tem lá dentro: apps, contas do WhatsApp, Páginas. Atribuir um ativo é dar acesso a ele.",
  },
  {
    id: "token",
    matches: ["Gerar token", "token"],
    title: "Chave de acesso (token)",
    text: "Uma senha longa que a Meta gera para a ÓRBITA conversar com o seu WhatsApp. Guarde em segredo: quem tem a chave consegue enviar mensagens pelo número.",
  },
  {
    id: "permissoes",
    matches: ["permissões"],
    title: "Permissões",
    text: "O que a chave pode fazer. Para a ÓRBITA bastam duas: gerenciar a conta do WhatsApp e enviar mensagens.",
  },
  {
    id: "webhook",
    matches: ["webhook", "URL de callback"],
    title: "Webhook (endereço de entrega)",
    text: "É o endereço para onde a Meta entrega as mensagens dos seus clientes. Com o endereço da ÓRBITA, elas chegam no Chat da ÓRBITA, já ligadas ao funil.",
  },
  {
    id: "api",
    matches: ["API"],
    title: "API",
    text: "É a porta oficial que a Meta abre para sistemas como a ÓRBITA enviarem e receberem mensagens do WhatsApp, sem precisar de celular ligado.",
  },
  {
    id: "numero-teste",
    matches: ["número de teste"],
    title: "Número de teste",
    text: "Um número grátis que a Meta cria só para experimentar. Ele envia para até 5 telefones cadastrados e não serve para campanhas de verdade.",
  },
  {
    id: "nome-exibicao",
    matches: ["nome de exibição"],
    title: "Nome de exibição",
    text: "O nome da empresa que aparece para o cliente no WhatsApp. A Meta revisa em até 2 dias.",
  },
  {
    id: "fuso",
    matches: ["fuso"],
    title: "Fuso horário da conta",
    text: "Define o horário das faturas da Meta. Use São Paulo (GMT-03:00): depois de salvo, não dá para trocar.",
  },
];
