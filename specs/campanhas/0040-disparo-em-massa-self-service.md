---
id: 0040
titulo: Disparo em Massa self-service — número oficial, custos, taxa e subida de volume
dominio: campanhas
status: em-revisao
autor: Weydson
criada: 2026-09-27
atualizada: 2026-09-27
branch: feature/W-campanhas-disparo-self-service-20260927
pr:
peso: completa
---

# 0040 — Disparo em Massa self-service

## 1. Contexto

Para usar o Disparo em Massa, a equipe hoje compra o chip na Salvy e configura tudo à mão no
painel da Meta — complexo até para a equipe. O Embedded Signup já existe no código
(`onboard.ts`), mas fica escondido: sem as envs públicas, exige criar a instância antes e divide
a tela com um formulário manual de 5 campos. Campanhas não estimam nem cobram nada, e o custo
exibido no analytics vem de `conversation_analytics`, aposentado desde a cobrança por mensagem
(jul/2025).

## 2. Objetivo

O dono da org conecta o número oficial, cadastra o cartão na Meta, entende custos e limites, paga
a taxa ÓRBITA e dispara — sozinho, com ajuda da equipe a um clique.

### Não-objetivos

- Créditos de mensagens na ÓRBITA (linha de crédito): depende de sermos Solution Partner.
- Programa STARS FRIENDS: vem de outra branch; aqui só o modelo de mensagem e o link.
- Aprovação da Meta (App Review, Tech Provider): processo fora do código, com checklist no doc.

## 3. Requisitos

| ID | Requisito |
|---|---|
| RF-1 | **Antes de começar**: cartões com as regras da Meta (quem cobra, o que é grátis, Utilidade × Marketing, opt-in, qualidade, BRL, subida de volume) e **simulador**: contatos × categoria → custo Meta + taxa ÓRBITA + dias necessários no limite atual, com a economia de Utilidade. |
| RF-2 | **Recomendação de Utilidade** com modelo pronto de template (saldo STARS FRIENDS) e botão para o In-Chat da org (`/whatsapp/{slug}`); aviso de que texto promocional vira Marketing. |
| RF-3 | **Assistente "Conectar número oficial"**: número (trazer ou comprar Salvy) → Meta (Embedded Signup) → cartão (Billing Hub) → pronto (nome, qualidade, limite). Animado, com copiar e colar e imagens com o ponto onde colar. |
| RF-4 | Embedded Signup cria a instância `META_CLOUD` se não existir e grava o `business_id`. Formulário manual vira "Configuração avançada (suporte)", fechado. |
| RF-5 | **Comprar número Salvy**: cria o número virtual pela conta ÓRBITA, cobra Stars mensais (catálogo `AppStarCost`, slug `salvy-number`; sem preço configurado não vende), e o SMS de verificação é consultado na API da Salvy a cada 4 s e aparece ao vivo no assistente. Sem Stars na renovação: `past_due` e cancelamento na Salvy após 3 dias. |
| RF-6 | **Taxa ÓRBITA por campanha**: percentual por faixa sobre o custo Meta estimado (faixas do admin; padrão 50→25%, mínimo R$ 19,90), paga em checkout (cartão Stripe ou PIX/boleto Asaas). Com a cobrança ligada (`BroadcastFeeSettings.enabled`), a campanha só dispara depois do pagamento, que é conferido na API do provedor e libera o disparo/agendamento. |
| RF-7 | **Subida de volume**: campanha maior que o limite diário (contatos únicos/24h do portfólio) é dividida em lotes diários automaticamente; o cliente vê o plano antes de pagar. |
| RF-8 | **Painel "Número e gastos"**: número, qualidade, nível de limite e o próximo (com o que a Meta exige), gasto do mês por categoria (`pricing_analytics`), atalhos para cartão e fatura. |
| RF-9 | **Pedir ajuda à equipe** em todo o fluxo: chamado preenchido com o contexto (`SupportTicket`) e WhatsApp da equipe. |
| RF-10 | Alerta quando a qualidade do número cai ou o limite é atingido. |
| RF-11 | **Chaves coladas uma vez**: sem Embedded Signup, o assistente guia as telas da Meta (um passo por tela, print com seta vermelha animada, dados pessoais borrados) e o cliente cola chave de acesso + ID do app + chave secreta. A ÓRBITA confere (`debug_token`), descobre a conta WhatsApp e grava cifrado no funil — as configurações do tracking aparecem preenchidas. |
| RF-12 | **ÓRBITA faz o número e o webhook**: cadastra o número na conta, pede/valida o código, registra (PIN cifrado em `metaTwoStepPin`) e liga webhook do app (`/{app}/subscriptions`, callback HTTPS) + inscrição na conta. |
| RF-13 | **Astro guia e executa**: balões de incentivo por fase/marco do guia e pack de tools `whatsapp-setup` (status, cadastrar número, pedir/validar código) com checagem de papel. |
| RF-14 | **Progresso no banco e chaves coladas onde são copiadas**: cada chave tem campo no passo em que é copiada (token no passo "Copie a chave"; ID e chave secreta no passo seguinte), salva cifrada em `WhatsAppConnectProgress`; o passo "Confira suas 3 chaves" abre preenchido. Passo atual, etapas feitas e balões do Astro já exibidos ficam no banco — o cliente continua em qualquer aparelho. Rascunhos apagados após gravar na instância. |
| RF-15 | **Links diretos e prints focados**: no passo do painel do app o cliente cola o link da página; a ÓRBITA extrai o ID do app e o `business_id` (salvos em `WhatsAppConnectProgress`) e todo "Abrir" dali em diante vai direto na tela daquele app/portfólio (`guideStepLink`). Prints recortados na área útil (`shot.crop`), com a seta recalculada sobre o recorte. |
| RF-16 | **Jornada espacial**: ao lado do assistente (telas grandes), um foguete sobe por planetas (etapas) e asteroides (passos), junto com a barra "Sua configuração", somando STARs visuais a cada parada. Componentes reutilizáveis em `src/features/space-journey/` — ver `docs/space-journey-gamificacao.md`. STARs não entram no saldo até decisão de produto. |
| RF-17 | **Assistente sem rolagem e escolha no chat**: o popup "Conectar número oficial" tem altura fixa e o print encolhe inteiro no espaço que sobra (seta continua no alvo). Ao abrir o chat num funil sem número conectado, um popup explica e oferece as duas opções: QR Code/Uazapi (alto risco de bloqueio) ou API Oficial (recomendado; menos risco, número novo), que abre o assistente ali mesmo. "Decidir depois" esconde só naquela visita; volta a aparecer ao abrir o chat de novo enquanto não houver número. |
| RF-18 | **Conta nova do WhatsApp**: depois de "Comece a usar a API", o guia pergunta se o cliente já tem conta do WhatsApp Business com o número (a "Test WhatsApp Business Account" não conta). "Já tenho" pula para o usuário do sistema; "Ainda não" mostra 3 passos com prints: Contas do WhatsApp → + Adicionar → Criar nova conta; nome e categoria; número e código. No passo de atribuir ativos, aviso para não marcar a conta de teste. |
| RNF-1 | Valores de taxa e custo recalculados no servidor; nada vem do navegador. |
| RNF-2 | I/O (Meta, Salvy, Stripe, Asaas) fora de transação (Regra 18). |

## 4. Critérios de aceite

- [ ] **CA-1** — Simulador: 1.000 contatos em Marketing × Utilidade mostram os dois custos, a taxa da faixa e a economia; com limite 250, "4 dias".
- [ ] **CA-2** — `quoteBroadcastFee` aplica a faixa certa em cada limite e o mínimo em campanhas pequenas.
- [ ] **CA-3** — Embedded Signup sem instância cria a instância e grava `business_id`.
- [ ] **CA-4** — Com a cobrança ligada, campanha sem taxa paga não dispara; com pagamento confirmado na API do provedor, dispara. Desligada, nada muda.
- [ ] **CA-5** — Campanha de 600 contatos no nível 250 sai em 3 lotes diários.
- [ ] **CA-6** — SMS da Salvy aparece no assistente em até ~4 s (polling).
- [ ] **CA-7** — "Pedir ajuda" cria o chamado com o passo e o erro.
- [ ] **CA-8** — Chaves válidas preenchem o funil (provider META_CLOUD, WABA, app) e a tela de Integrações mostra os campos; chave sem `whatsapp_business_messaging` é recusada com mensagem clara.
- [ ] **CA-9** — Cadastrar número → código → confirmar deixa o número conectado sem abrir a Meta.
- [ ] **CA-10** — Prints do guia não exibem foto, nome, e-mail, tokens nem portfólios de outros clientes.

## 5. Decisões

- **D-1 — Cartão do cliente na Meta** (usuário, 2026-09-27); créditos na ÓRBITA só como Solution Partner.
- **D-2 — Número próprio ou Salvy** (usuário, 2026-09-27).
- **D-3 — Taxa por checkout por campanha**, faixas do /trafego (usuário, 2026-09-27); faixas configuráveis pelo admin, diferente do trafeGO que as tem fixas no código.
- **D-4 — API oficial direto**, sem MCP (usuário, 2026-09-27).
- **D-5 — Preços da Meta configuráveis** (env): a Meta não publica tabela por API.
- **D-6 — Lotes diários pelo limite do portfólio** (usuário, 2026-09-27: "um número novo nunca vai enviar para toda a base").
- **D-7 — Cobrança da taxa atrás de chave** (`BroadcastFeeSettings.enabled`, padrão desligada): quem já dispara em produção não é bloqueado no deploy; o admin liga quando o fluxo estiver validado.
- **D-9 — Astro guia + ÓRBITA automatiza por API** (usuário, 2026-09-28): extensão de navegador fora; MCP da Meta é para desenvolvedor. Callback em HTTPS (`https://orbita.nasaex.com/api/chat/webhook/official`).
- **D-8 — Confirmação por consulta, não por webhook**: Stripe e Asaas são relidos pela API (`confirmFee`, chamado pela tela ao voltar do checkout e a cada 8 s). Evita mexer nos webhooks compartilhados de Stripe/Asaas. SMS da Salvy também por consulta (webhook deles é Svix).

## 6. Referências Meta

- Pricing: developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Categorização de templates: .../whatsapp/templates/template-categorization
- Limites de mensagens: .../whatsapp/messaging-limits

## 9. Changelog

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-27 | Weydson | Criada a partir do plano aprovado e das decisões D-1 a D-6. |
| 2026-09-28 | Weydson | Bifurcações mapeadas (matriz no guia); pergunta "Você já tem um app na Meta?"; avisos para portfólio, admin, "Anular tokens", webhook de outro sistema, número em uso. Meta abre em janela lateral, aviso "faça só o que o passo mostra" + "Minha tela está diferente", botão pulsa ao voltar. |
| 2026-09-28 | Weydson | Instruções do guia viram checklist (✅ por ação, `instructionChecklist` quebra frases e verbos de ação) com luz descendo item a item (`guide-shine-text`). Campanhas entra no menu lateral por padrão. |
| 2026-09-28 | Weydson | Webhook no guia do cliente: 4 passos visíveis (abrir Configuração, colar URL + token, campos, assinar `messages`). Verify token próprio por funil, gerado e cifrado pela ÓRBITA; handshake aceita esse token sem exigir o número. |
| 2026-09-28 | Weydson | Bifurcação "Você já tem um usuário do sistema?": "Já tenho" pula para "Dê acesso ao app e ao WhatsApp"; o campo do link do portfólio fica nessa pergunta. |
| 2026-09-28 | Weydson | RF-17: a escolha Uazapi × API Oficial também aparece em empresa sem nenhum funil; ao escolher, a ÓRBITA cria o funil ("WhatsApp Oficial" ou "WhatsApp") e segue. |
| 2026-09-28 | Weydson | Etapa Cartão: 3 prints em sequência (Configurações de pagamento → Adicionar forma de pagamento → país/moeda/fuso São Paulo, definitivo). Dados do cartão ficam com o cliente. |
| 2026-09-28 | Weydson | `saveMetaKeys`: chave sem `target_ids` (vale para todas as contas liberadas) devolve `need_waba_id`; o cliente cola o ID da conta e a ÓRBITA confere com `GET /{waba}`. Testado ponta a ponta com número de teste da Meta (+1 555-140-0565). |
| 2026-09-28 | Weydson | Guia da chave reordenado: liberar o app ao usuário do sistema antes de gerar o token (sem isso a Meta mostra "Nenhuma permissão disponível"); permissões exigidas são só `whatsapp_business_management` e `whatsapp_business_messaging`; avisos para limite de 1 admin e para remoção acidental de permissões. |
| 2026-09-28 | Weydson | RF-18: pergunta "já tem conta do WhatsApp?" e passos para criar a conta nova; guia renumerado (46 passos). |
| 2026-09-28 | Weydson | RF-17: assistente sem rolagem (print ajustado) e escolha Uazapi × API Oficial na primeira entrada do chat. |
| 2026-09-28 | Weydson | RF-16: jornada espacial (foguete, planetas, asteroides, STARs visuais) no assistente. |
| 2026-09-28 | Weydson | RF-15: links do guia abrem direto no app/portfólio do cliente; prints recortados. Migration `20260928160000_connect_progress_business_id`. |
| 2026-09-28 | Weydson | RF-14: progresso do assistente no banco e chaves coladas no passo em que são copiadas. |
| 2026-09-28 | Weydson | RF-11 a RF-13, CA-8 a CA-10, D-9: guia de 41 passos com prints, chaves coladas uma vez, automação de número/webhook e pack do Astro. |
| 2026-09-27 | Weydson | D-7 (chave da taxa) e D-8 (confirmação por consulta); RF-5/RF-6, CA-4 e CA-6 ajustados à implementação. |
| 2026-09-28 | Weydson | Número que já existia na conta (ex.: o de teste) passa a ser registrado na Cloud API ao ser escolhido (PIN cifrado), com autorreparo no `setupStatus` — sem isso o envio falhava com (#133010). Disparo libera a reserva `SENDING` se o enfileiramento no Inngest falhar. Validado E2E: `hello_world` entregue. |
