// Passo a passo do token da Meta nos Satélites (spec 0125). O login com Facebook não serve
// para o Astro: pedir ads_mcp_management para outras empresas exige o app da Órbita aprovado
// pela Meta (Acesso Avançado). Até lá, o cliente gera o token no próprio portfólio.

export const META_TOKEN_TUTORIAL_STEPS = [
  "No business.facebook.com, abra Configurações do negócio > Usuários > Usuários do sistema e crie um com a função \"Funcionário\". Não use \"Administrador\": a Meta recusa esse token no Astro.",
  "Ainda no usuário do sistema, clique em \"Atribuir ativos\" e dê a ele a conta de anúncios (controle total) e a página do Facebook ligada ao Instagram e ao WhatsApp.",
  "No developers.facebook.com, use um app do tipo Empresa que esteja no mesmo portfólio (Configurações do negócio > Contas > Apps). Em \"Casos de uso\", adicione o de anúncios (Marketing API) e o \"Crie e gerencie anúncios com o servidor MCP de anúncios\", que é o do Astro.",
  "Volte ao usuário do sistema e clique em \"Gerar token\": escolha esse app, validade \"Nunca\" e marque ads_read, ads_management, pages_show_list, pages_read_engagement, pages_manage_ads, business_management e ads_mcp_management.",
  "Copie o token na hora (a Meta só mostra uma vez). O App ID e o App Secret ficam em App > Configurações > Básico; o ID da conta (act_...) fica no Gerenciador de Anúncios.",
  "Cole tudo abaixo, salve e clique em \"Testar conexão\". O teste mostra a conta, a página e o que ainda falta.",
];
