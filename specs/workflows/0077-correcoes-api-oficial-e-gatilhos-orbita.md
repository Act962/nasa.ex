---
id: 0077
titulo: Correções API Oficial e Gatilhos ÓRBITA — fechar a jornada comentário → WhatsApp → curso → lead ganho
dominio: workflows
status: rascunho
autor: Weydson
criada: 2026-10-08
atualizada: 2026-10-09
branch: feature/W-orbita-correcoes-api-oficial-e-gatilhos-20261008
pr: # preenchido no /ship
peso: completa
---

# 0077 — Correções API Oficial e Gatilhos ÓRBITA

> **Para quem continua (João)**: esta spec nasceu de uma sessão em que a jornada abaixo foi
> configurada em produção para o cliente Pleno Car e esbarrou em cinco furos de código.
> Nada foi implementado ainda — só o diagnóstico (lido no código, **não** reproduzido em
> runtime) e a configuração de produção descrita na seção 1.2. As decisões marcadas como
> **em aberto** na seção 6 precisam de resposta do Weydson antes do código.

---

## 1. Contexto

### 1.1 A jornada que o cliente precisa

A Pleno Car (centro automotivo, Teresina) está vendendo o curso "Estética Automotiva Premium"
pelo ÓRBITA Route com uma série de Reels. A jornada desejada, de ponta a ponta:

1. Pessoa comenta **CURSO** no Reel publicado pelo Planner.
2. Comments responde em público e manda DM com botão para o WhatsApp
   (`wa.me/5586995434656?text=Fiquei interessado no curso`).
3. A pessoa manda a mensagem no WhatsApp da empresa, que é **API Oficial (Meta Cloud)** e
   está ligado ao tracking **API OFICIAL**. Vira lead nesse tracking.
4. Uma automação do tracking responde sozinha: "Assista nossas 2 aulas gratuitas no link
   `https://orbita.nasaex.com/c/plenocar/estetica-automotiva`".
5. A pessoa assiste, compra pelo Stripe do Route.
6. Quando o pagamento cai, **o mesmo lead** recebe o valor do curso no campo "Valor"
   (Detalhes do lead) e vai para **Ganho**.
7. A equipe acompanha o andamento do aluno (aulas concluídas) a partir do lead.

As etapas 1, 2 e 3 funcionam hoje. As etapas 4, 6 e 7 não funcionam, e a 5 funciona só em
parte.

### 1.2 O que já foi configurado em produção (08/10/2026)

| Item | Estado | Identificador |
| --- | --- | --- |
| Reel no Planner (@plenocar) | Rascunho, com vídeo, capa, legenda | título "Curso de Estética Automotiva — Leno libera o link" |
| Comentários automáticos do post | Salvo, "liga ao publicar"; palavra `curso`; botão "Falar no WhatsApp" | painel do post no Planner |
| Funil de vendas do curso | Tracking **API OFICIAL**, status **Em andamento** (antes: COMERCIAL / Em atendimento) | curso `cmrw3bhgn33jt0vs56kt9fsuf` |
| Automação "Responder Interesse no Curso" | Criada **inativa** | workflow `i1j2mq083olbttkn3clp5l6b`, tracking `cmuyjxb8y052f01jpko8o8xtx` |

A automação ficou inativa de propósito: ligada, ela dispararia e falharia (furo F-1), e ela
usa "Decisão da IA" a cada mensagem recebida porque o modo rápido não tem condição (furo F-5).

### 1.3 Os furos

| # | Furo | Evidência no código |
| --- | --- | --- |
| F-1 | Ações de envio dos workflows não funcionam em tracking com instância `META_CLOUD` | `src/features/tracking-executions/components/send-message/executor.ts` chama `requireUazapiToken(instance.apiKey)` direto (linhas ~193–325). Instância Meta tem `apiKey` nulo. O chat usa `resolveOutboundProvider` (`src/features/tracking-chat/lib/providers/resolve-outbound-provider.ts`); os executores não. Mesmo padrão em `tracking-executions/lib/send-link-to-lead.ts`, `send-buttons-to-lead.ts` e `workflows/lib/agent-executors/apps.ts` |
| F-2 | Compra pelo checkout público (sem login) não cria nem move lead | `createPurchaseSideEffects` só é chamado em `routes/purchase-course.ts` (grátis/logado) e em `src/app/api/stripe/webhook/route.ts` dentro de `if (pending.flow === "authenticated" …)` (linha ~480). O fluxo anônimo termina em `routes/redeem-course-purchase.ts`, que não chama o helper |
| F-3 | A compra não preenche o "Valor" do lead nem marca Ganho | `createOrActivateLead` em `src/app/router/nasa-route/helpers/purchase-crm-side-effects.ts` grava só `statusId`, `statusEnteredAt` e `currentAction: "ACTIVE"`. `Lead.amount` (schema linha ~1133) nunca é tocado; o valor vai apenas para o `PaymentEntry` |
| F-4 | Progresso do aluno não aparece no lead | `routes/mark-lesson-complete.ts` atualiza `NasaRouteProgress` e nada mais. Não há referência a matrícula/progresso em `src/features/leads` |
| F-5 | Modo rápido de gatilhos não tem "mensagem contém" | `src/features/workflows/components/quick-builder/quick-catalog.ts` não oferece `IF_CONDITION`. A montagem por descrição cai em `AI_DECISION`, que roda (e cobra) a cada mensagem. O próprio form orienta usar condicional sobre `trigger.messageText` (`agent-node-forms.tsx` ~linha 976), mas isso só existe no modo avançado |

Nenhum desses furos foi reproduzido em produção: são leitura de código. O primeiro passo da
implementação é reproduzir cada um (seção 8).

### 1.4 Achados em produção (09/10/2026)

Depois do merge da fatia F-1 (PR 450), o fluxo foi ligado em produção no tracking API OFICIAL
da Pleno Car e observado com mensagens reais. Diferente da seção 1.3, tudo aqui foi **visto em
runtime**, no histórico de execuções.

**Validação de F-1 (CA-1)**: às 19:49 um lead novo ("LH Envelopamento", origem WhatsApp) mandou
"Fiquei interessado no curso" e o workflow `m348am3jqrfg0krgkscclykv` rodou os cinco passos com
sucesso em instância `META_CLOUD`: `MESSAGE_INCOMING → IF_CONDITION → SEND_MESSAGE → TAG →
SEND_MESSAGE`. O envio de texto livre pela API Oficial, com janela aberta, funciona.

| # | Achado | Evidência |
| --- | --- | --- |
| F-6 | E-mail de automação não sai em produção | Workflow "Notificação Novo Lead Pleno Car" (`NEW_LEAD → SEND_EMAIL`), execução de 19:49: passo `SEND_EMAIL` falhou com `This API key is not authorized to send emails from nasaagents.com`. O remetente vem de `RESEND_FROM_EMAIL ?? "noreply@nasaagents.com"` (`src/features/workflows/lib/agent-executors/email.ts`). É configuração do Resend/ambiente (domínio não verificado para a chave em uso, ou `RESEND_FROM_EMAIL` ausente), não do workflow |
| F-7 | Passo "Enviar e-mail" não tem campo de destinatário em tela nenhuma | No modo rápido, `quick-step-fields.tsx` (caso `SEND_EMAIL`) só mostra assunto e texto; `toEmail` fica no padrão `{{lead.email}}` do `quick-catalog.ts`. No editor em canvas o nó aparece como um retângulo branco, sem rótulo e sem diálogo de configuração. O executor já aceita `action.toEmail` fixo — só a montagem por descrição consegue gravá-lo |
| F-8 | Montagem por descrição cria `IF_CONDITION` sem condição utilizável na tela | Pedindo "se a mensagem contém X", o rascunho gravou `data.condition = { op: "contains", left: "vars.lastIncomingMessage", right: "…" }`, mas o diálogo do nó lê `data.conditions[]` e abriu **vazio**. Foi preciso adicionar à mão `trigger.messageText contém …`. Hoje o nó guarda os dois formatos; falta confirmar qual o executor avalia e unificar |
| F-9 | Execução aparece como `SUCCESS` com passo `FAILED` | Execução de 19:47 (lead "Weydson Lima"): `SEND_MESSAGE` falhou com `Lead is not active`, os passos seguintes não rodaram, e a execução ficou com `status: SUCCESS`, `nodesExecuted: 3`. Quem olha a lista de execuções não vê que o lead ficou sem resposta |
| F-10 | "IA desativada" no lead bloqueia toda automação, sem aviso | `Lead.isActive = false` (chave "Ativar IA" do chat, ou `api/chat/ia/deactive`) faz `send-text-message`, `send-link-to-lead`, `send-buttons-to-lead` e `send-template-to-lead` lançarem `Lead is not active`. Pode ser intencional (atendimento humano assumiu), mas a tela não diz que desligar a IA também desliga os gatilhos, e a tag e os demais passos não-WhatsApp deixam de rodar junto |

Observação sem diagnóstico: o mesmo lead inativo recebeu "Bom dia! Como posso ajudá-lo hoje?"
às 19:47 (era noite). Não veio dos workflows criados para o curso nem do workflow "Sem título"
(`PRIMEIRA INTERAÇÃO DO DIA → MENU DE BOTÕES`), que não registrou execução. Origem a investigar
— se for a IA do chat, ela respondeu a um lead com `isActive = false`.

Estado de produção em 09/10, além da seção 1.2:

- Reel publicado às 18h; automação do Comments ativa, responde a **qualquer** comentário com
  DM + botão "Falar no WhatsApp" (`wa.me/558695434656`, o número como a Meta registra).
- Workflow "Resposta a Interesse no Curso" (`m348am3jqrfg0krgkscclykv`) **ativo**: condição
  `trigger.messageText contém "interessado no curso"` → saudação → tag "Interesse no Curso" →
  link do curso.
- Workflow "Notificação Novo Lead Pleno Car" **ativo**, falhando por F-6.
- Sobraram inativos, para apagar: "Aviso de novo lead por e-mail" (`y697qhn8bbqiumo59a831yio`,
  destinatário errado) e "Responder Interesse no Curso" (`i1j2mq083olbttkn3clp5l6b`, com
  Decisão da IA).

## 2. Objetivo

Um lead que chega pelo WhatsApp API Oficial interessado num curso recebe a resposta automática,
compra, e o **mesmo lead** passa a ter o valor pago e o estado Ganho assim que o Stripe confirma
— com o andamento do aluno visível a partir do lead.

### Não-objetivos

- Template com cabeçalho de mídia ou botões dinâmicos: o envio só preenche variáveis de corpo
  e de título em texto (mesmo limite do chat). Esses modelos aparecem desabilitados na lista.
- Trocar sozinho para um template **não configurado** quando a janela está fechada: sem
  template reserva (RF-14), o passo falha com erro claro (CB-2).
- Menu de botões e listas pela API Oficial (decidido em 2026-10-08: fica para depois).
- Voz gerada por IA (`SEND_VOICE`) pela API Oficial: falha com mensagem clara.
- Botões/listas interativas pela API Oficial nos workflows (hoje o chat também bloqueia com
  `META_FEATURE_UNSUPPORTED`).
- Lead a partir de quem só assistiu às aulas gratuitas sem se cadastrar
  (`public-get-free-lesson`).
- Mudanças no Comments ou no Planner — essas etapas já funcionam.
- Liberar organizações na chave do MCP externo (é configuração, não código).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | As ações de workflow que enviam WhatsApp (Enviar Mensagem — texto, imagem, documento; Enviar Mídia; envio de link; Enviar Curso ÓRBITA Route) passam a resolver o provedor do tracking pelo mesmo caminho do chat (`resolveOutboundProvider`) e funcionam com `UAZAPI` e `META_CLOUD` |
| RF-2 | Com `META_CLOUD`, ação não suportada (botões/lista) ou janela de 24 h fechada falha **o passo** com mensagem legível no histórico da execução — nunca erro genérico de credencial |
| RF-3 | Compra paga pelo checkout público (sem login) executa os mesmos efeitos de CRM da compra logada: lead criado/movido no tracking do curso, `PaymentEntry` e gatilho "Pagamento Recebido" |
| RF-4 | Ao confirmar o pagamento, o lead recebe em `amount` o valor efetivamente pago (em reais) |
| RF-5 | Ao confirmar o pagamento, o lead é marcado como **Ganho** (`currentAction: WON`), conforme a decisão D-3 |
| RF-6 | O lead só muda (status, valor, Ganho) **depois** da confirmação do Stripe — nunca na abertura do checkout |
| RF-7 | A busca do lead existente compara telefone **normalizado** (só dígitos, com e sem DDI 55, com e sem o nono dígito), não igualdade de texto |
| RF-8 | Nos Detalhes do lead aparece o curso comprado e o progresso (aulas concluídas / total, e data de conclusão) |
| RF-9 | Concluir o curso registra um evento na jornada do lead |
| RF-11 | O passo "Enviar Mensagem" ganha o tipo **Template (API Oficial)**: lista os modelos aprovados da conta (os mesmos do app de Campanhas), e cada variável `{{n}}` aceita texto fixo ou variáveis do lead. Funciona dentro e fora da janela de 24 h, nas duas engines (clássica e modo agente) |
| RF-12 | Em tracking `META_CLOUD`, texto/imagem/documento/mídia/link conferem a janela de 24 h **antes** de enviar e de cobrar Stars; fechada, o passo falha orientando a usar Template |
| RF-13 | Os demais envios automáticos de WhatsApp (automação de inatividade, confirmação de agendamento, notificação de formulário, lembretes, IA do chat, Astro, workflows de workspace, notificação administrativa) resolvem o provedor pelo mesmo caminho. Para o lead, janela fechada = envio pulado sem cobrança; o resto do fluxo (ex.: avisar o responsável) continua |
| RF-14 | O passo "Enviar Mensagem" de texto, imagem ou documento aceita um **template reserva** opcional. Em `META_CLOUD` com a janela fechada, o passo envia a reserva no lugar da mensagem; sem reserva, falha como antes |
| RF-15 | No modo rápido de gatilhos, em tracking `META_CLOUD`, o passo "Enviar mensagem" oferece "Texto livre" ou "Template aprovado"; o gatilho não é criado com template incompleto |
| RF-16 | Avisos para quem não é o lead não usam template global da plataforma: o template tem de ser o do próprio cliente. O passo "Enviar mensagem aos participantes" (workspace) ganha o tipo Template em instância `META_CLOUD`. Lembrete para telefone que não é o do lead, notificação de formulário e notificação administrativa **não são enviados** em `META_CLOUD`, e nada é cobrado (pendência: deixar o cliente escolher o template) |
| RF-10 | O modo rápido de gatilhos oferece, para o gatilho "Lead manda mensagem", o filtro "só quando a mensagem contém ___", gerando `IF_CONDITION` sobre `trigger.messageText` |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhum workflow existente em tracking Uazapi muda de comportamento (RF-1 é troca de caminho, não de resultado) |
| RNF-2 | Efeitos de CRM da compra continuam **fora** de `prisma.$transaction` e best-effort (CLAUDE.md regra 18): falha em lead/gatilho não desfaz matrícula já paga |
| RNF-3 | Efeitos de CRM são idempotentes: reentrega do webhook do Stripe ou resgate repetido não duplica lead, `PaymentEntry` nem evento |
| RNF-4 | Sem `any` novo; o `as any` do filtro `OR` em `createOrActivateLead` sai junto (regra 13) |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um tracking com instância `META_CLOUD` e janela aberta, quando um workflow executa "Enviar Mensagem" (texto), então a mensagem chega no WhatsApp do lead e o passo fica como sucesso.
- [ ] **CA-2** — Dado o mesmo workflow num tracking `UAZAPI`, quando executa, então o resultado é idêntico ao de antes da mudança.
- [ ] **CA-3** — Dado tracking `META_CLOUD` com janela de 24 h fechada, quando o passo de envio roda, então o passo falha com mensagem que cita a janela, e a execução não lança erro de credencial.
- [ ] **CA-13** — Dado tracking `META_CLOUD` e lead com a janela fechada (ou que nunca escreveu), quando o workflow executa "Enviar Mensagem" do tipo Template, então o modelo chega no WhatsApp do lead e a mensagem aparece no chat com as variáveis preenchidas.
- [ ] **CA-14** — Dado tracking `UAZAPI`, quando um passo do tipo Template roda, então o passo falha dizendo que template exige a API Oficial, e nada é cobrado.
- [ ] **CA-15** — Dado um template cuja variável resolve vazia para o lead (ex.: `{{email}}` sem e-mail), então o passo falha citando a variável, sem enviar.
- [ ] **CA-16** — Dado tracking `META_CLOUD` e lead dentro da janela, quando a IA do chat responde, a automação de inatividade dispara ou um agendamento é confirmado, então a mensagem chega e fica registrada na conversa.
- [ ] **CA-17** — Dado tracking `META_CLOUD` e lead fora da janela, quando a automação de inatividade ou a confirmação de agendamento roda, então nada é enviado nem cobrado, e a notificação ao responsável continua saindo.
- [ ] **CA-18** — Dado um passo de texto com template reserva, em `META_CLOUD`: com a janela aberta chega o texto; com a janela fechada chega o template reserva; nos dois casos o passo fica como sucesso.
- [ ] **CA-19** — No modo rápido, em tracking `META_CLOUD`, escolher "Template aprovado" cria um workflow cujo passo tem `payload.type = TEMPLATE`; em tracking `UAZAPI` a escolha não aparece.
- [ ] **CA-20** — Em tracking `META_CLOUD`, um lembrete para o telefone de alguém da equipe não envia WhatsApp nem cobra Stars, e o sino/push saem normalmente; o mesmo lembrete em `UAZAPI` chega como texto, igual a antes.
- [ ] **CA-4** — Dado um visitante sem conta, quando paga o curso pelo checkout público e conclui o cadastro, então existe exatamente um lead no tracking configurado no curso, no status configurado.
- [ ] **CA-5** — Dado um lead já existente no tracking do curso com o telefone `5586999990000`, quando a compra é feita informando `(86) 99999-0000`, então o lead existente é atualizado e nenhum lead novo é criado.
- [ ] **CA-6** — Dado um curso pago, quando o Stripe confirma o pagamento, então `Lead.amount` é igual ao valor pago em reais e o lead está como Ganho.
- [ ] **CA-7** — Dado um checkout aberto e **não** pago, então o lead não tem valor nem está como Ganho.
- [ ] **CA-8** — Dado o mesmo evento do Stripe entregue duas vezes, então há um único lead, um único `PaymentEntry` e uma única mudança para Ganho.
- [ ] **CA-9** — Dado um aluno com lead vinculado, quando conclui uma aula, então os Detalhes do lead mostram o novo total de aulas concluídas.
- [ ] **CA-10** — Dado o mesmo aluno, quando conclui a última aula, então a jornada do lead ganha um evento de curso concluído.
- [ ] **CA-11** — No modo rápido, dado o gatilho "Lead manda mensagem" com o filtro "contém `interessado no curso`", quando o gatilho é criado, então o workflow tem um `IF_CONDITION` sobre `trigger.messageText` e **não** tem `AI_DECISION`.
- [ ] **CA-12** — Com o workflow do CA-11 ativo, quando o lead manda "bom dia", então nenhuma mensagem é enviada.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Instância `META_CLOUD` com credencial incompleta ou desconectada | Passo falha com erro de configuração legível; workflow não trava os próximos leads |
| CB-2 | Janela de 24 h fechada (workflow com "Esperar" longo) | Com template reserva: envia a reserva. Sem reserva: o passo falha antes do envio, com mensagem que cita a janela e manda usar Template |
| CB-24 | Notificação de formulário em tracking `META_CLOUD` | Função termina como pulada (`official_api_needs_client_template`), sem cobrar nenhum destino |
| CB-25 | Passo "Enviar mensagem aos participantes" (workspace) com instância `META_CLOUD` | Só o tipo Template é oferecido e enviado (modelos da conta do cliente, variáveis da ação e do participante). Nó antigo de texto/imagem/documento falha com mensagem clara, sem cobrar |
| CB-26 | Lembrete cujo telefone é o do próprio lead | Com a janela aberta vai texto livre; com a janela fechada o WhatsApp é pulado |
| CB-19 | Envio para número customizado ("Customizar envio") em `META_CLOUD` | Não há conversa para conferir a janela: envia e deixa a Meta decidir |
| CB-23 | IA do chat tenta enviar botões/lista em `META_CLOUD` | A tool devolve erro ao modelo orientando a responder em texto |
| CB-20 | Template para lead sem conversa (nunca escreveu) | A conversa é criada no envio — template é justamente o que abre conversa |
| CB-3 | Ação de botões/lista em tracking `META_CLOUD` | Falha com "não suportado na API Oficial"; validação do editor avisa antes de ativar, se viável |
| CB-4 | Tracking sem instância de WhatsApp | Comportamento atual preservado (erro de instância não encontrada) |
| CB-5 | Lead existe em **outro** tracking da organização, não no do curso | **Em aberto (D-4)**: hoje cria um segundo lead no tracking do curso |
| CB-6 | Comprador sem telefone e com e-mail diferente do usado no WhatsApp | Não há como casar: cria lead novo. Documentar; não tentar adivinhar |
| CB-7 | Mesmo aluno compra o mesmo curso de novo / outro plano | Reusa o lead; `amount` conforme D-2 |
| CB-8 | Lead já estava Ganho por outra venda | Conforme D-2 (somar ou sobrescrever) |
| CB-9 | Matrícula grátis (curso `isFree`, plano de preço 0, acesso livre) | Move o lead para o status do funil; **não** marca Ganho e não altera `amount` |
| CB-10 | Pagamento assíncrono (boleto/PIX pelo Stripe) | Lead só muda no evento de confirmação, não no `checkout.session.completed` pendente |
| CB-11 | Reembolso ou chargeback depois do Ganho | **Em aberto (D-5)** |
| CB-12 | Webhook do Stripe reentregue; resgate chamado duas vezes | Idempotente (RNF-3) |
| CB-13 | Checkout público pago, cadastro nunca concluído (`PendingCoursePurchase` fica `PAID`) | **Em aberto (D-1)**: se os efeitos rodam no webhook, o lead existe mesmo sem cadastro; se rodam no resgate, o lead nunca aparece |
| CB-14 | Curso sem funil configurado (`purchaseTrackingId` nulo) | Nada de lead; só `PaymentEntry`, como hoje |
| CB-15 | Tracking ou status do funil foi apagado depois de configurado | Cai no primeiro status do tracking; se o tracking não existe, registra aviso e não cria lead |
| CB-16 | Aluno com matrícula mas sem lead (curso sem funil na época) | Progresso não aparece em lugar nenhum do CRM; sem backfill nesta spec |
| CB-17 | Duas mensagens seguidas contendo o termo do filtro | Uma resposta por mensagem é o comportamento atual do gatilho; avaliar "só na primeira" como melhoria, fora desta spec |
| CB-18 | Preço em Stars vs. BRL | `amount` usa o valor em reais efetivamente cobrado (`amountCents` já calculado para o `PaymentEntry`), não a conversão do preço de tabela |

## 6. Decisões de design

### D-1 — Onde rodam os efeitos de CRM do checkout público — **em aberto**

- **Proposta**: no webhook do Stripe, para os dois fluxos, usando os dados do comprador guardados no `PendingCoursePurchase` (nome, e-mail, telefone).
- **Alternativa**: no `redeem-course-purchase`, quando o usuário conclui o cadastro. Descartável porque quem paga e não conclui o cadastro some do CRM — justo o caso em que a equipe mais precisa agir.
- **Consequência**: precisa garantir idempotência entre webhook e resgate (RNF-3).

### D-2 — Como o valor entra no lead — **em aberto**

- **Proposta**: sobrescrever `amount` com o valor desta compra. Não dá para distinguir hoje um valor estimado digitado à mão de um valor já pago, então somar arriscaria inflar o lead.
- **Alternativa**: somar ao `amount` existente, para o lead que compra mais de um curso. Exige saber que o valor anterior também era venda paga.
- **Consequência**: afeta relatórios do Insights que somam `amount`. Decidir com o Weydson.

### D-3 — Ganho é automático ou opção do curso — **em aberto**

- **Pedido do Weydson**: "só for para Ganho quando o pagamento do Stripe cair".
- **Risco**: cursos já publicados passam a marcar Ganho sem ninguém ter pedido — novo "depende de" sobre dados de produção.
- **Proposta**: campo novo no curso, "Marcar lead como Ganho ao pagar", junto do "Funil de vendas". Padrão ligado para cursos novos; cursos existentes ficam desligados na migration, e o da Pleno Car é ligado à mão.
- **Alternativa**: sempre marcar Ganho, sem campo. Mais simples, muda o comportamento de todos.
- **Relação com status**: Ganho é `currentAction`, independente da coluna. O status do funil continua valendo.

### D-4 — Lead em outro tracking

- **Proposta**: manter a busca restrita ao tracking do curso (comportamento atual) e só corrigir a normalização do telefone (RF-7). Realocar lead entre trackings foi exatamente o que gerou o 500 da spec 0001; não reabrir isso aqui.

### D-5 — Reembolso

- **Proposta**: fora do escopo de código; registrar na `docs/nasa-route-overview.md` que o Ganho não é revertido automaticamente. Reavaliar se virar dor.

### D-6 — Progresso no lead: leitura, não cópia

- **Escolha**: os Detalhes do lead **consultam** matrícula e `NasaRouteProgress` pelo vínculo comprador ↔ lead; nada de copiar contadores para o lead.
- **Alternativa descartada**: gravar "aulas concluídas" no lead a cada aula — duplica fonte de verdade e exige escrita em toda conclusão de aula.
- **Consequência**: é preciso um vínculo estável entre matrícula e lead. Hoje o `leadId` vai só no `PaymentEntry`. Avaliar guardar `leadId` na matrícula (migration).

### D-7 — Executores usam a porta de provedores, sem atalho

- **Escolha**: trocar as chamadas diretas à Uazapi nos executores pelo provedor resolvido, reaproveitando o mapeamento de erros do chat (`map-outbound-error.ts`).
- **Alternativa descartada**: `if (provider === "META_CLOUD")` dentro de cada executor — espalha a regra e esquece o próximo executor.
- Os outros envios com `requireUazapiToken` (lembretes, notificações de formulário, agenda, IA do chat, Astro, workspace) entraram depois (RF-13). Restam só recursos que não são envio e só existem na Uazapi (histórico, etiquetas, validação de número) — listados em `docs/whatsapp-oficial-overview.md` §12.

### D-8 — Janela conferida antes do envio, não pelo erro da Meta

- **Escolha**: os executores consultam a última mensagem recebida do lead (`getCustomerWindow`, extraído do `message.customerWindow`) e falham antes de chamar a Meta.
- **Por quê**: fora da janela a Graph costuma responder 200 e só recusar depois, pelo webhook de status (`131047`). O passo ficaria "sucesso" sem a mensagem chegar — e com Stars cobradas.

### D-9 — Variáveis do template: texto com variáveis do lead, não o mapa de Campanhas

- **Escolha**: cada `{{n}}` é um campo de texto que aceita as variáveis que o passo já usa (`{{nome}}`, `{{email}}`…); no modo agente, `{{lead.x}}`/`{{vars.x}}`.
- **Alternativa descartada**: reusar o mapa de origens de Campanhas (nome do contato, coluna da planilha). As origens são de destinatário de disparo, não de lead em workflow.
- **Consequência**: o texto do modelo é copiado para o nó na hora da escolha (a Meta não devolve o corpo no envio). Se o modelo for editado na Meta depois, o histórico do chat mostra o texto antigo até o nó ser reaberto e salvo.

### D-11 — Reserva só no "Enviar Mensagem"; aviso interno por variável de ambiente

- **Reserva**: fica em `action.fallbackTemplate`, ao lado de `target` e `payload`. Não entrou nos envios de link (formulário, agenda, proposta…) nem no "Enviar Mídia" — quem precisa deles fora da janela usa um passo Template antes.
- **Aviso interno**: sem template global da plataforma. Chegou a ser implementado com uma variável de ambiente (`INTERNAL_NOTICE_WHATSAPP_TEMPLATE`) e foi **descartado** no mesmo dia: template é da conta de cada cliente, então um nome único definido pela plataforma não serve. Sem template do cliente, nada é enviado. Deixar o cliente escolher o template dele em cada aviso fica como pendência (`docs/whatsapp-oficial-overview.md` §12, 0077-d).

### D-10 — Uazapi sem mudança de comportamento

- A porta ganhou `typingDelayMs` para os workflows manterem o atraso de "digitando…" (2 s) na Uazapi; a Meta ignora. O id gravado em mensagens de texto continua sendo o `messageid` curto.
- Diferenças aceitas: o texto passa a marcar a conversa como lida (imagem, documento e botões já marcavam) e a usar a `baseUrl` da instância; áudio do nó "Enviar Mídia" sai como `myaudio`, igual ao chat.

## 7. Impacto

- [x] Schema / migration — provável: opção de Ganho no curso (D-3) e `leadId` na matrícula (D-6). Aplicar via `pnpm db:migrate` e seguir o ritual da regra 11.
- [x] Procedures oRPC — `creator-upsert-course` (campo novo), leitura de progresso nos detalhes do lead.
- [ ] Realtime (Pusher / event-bus)
- [x] Automações (Inngest) — executores de envio; gatilho "Pagamento Recebido" passa a disparar também no fluxo público.
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes — não, se D-3 ficar como opção desligada nos cursos atuais.
- [x] Documentação obrigatória — `docs/nasa-route-overview.md` (regra 10), `docs/whatsapp-oficial-overview.md` (regra 14). Campo novo no card do lead, se houver, entra em `CARD_FIELDS` (regra 16). Âncora/guia do Astro se surgir controle novo relevante (regra 21).

Domínios tocados: `workflows` e `tracking-executions` (dono), `tracking-chat` (provedores), `nasa-route`, `leads`.

Sugestão de fatiamento em PRs, na ordem de valor para o cliente:

1. F-1 (envio pela API Oficial) + F-5 (filtro no modo rápido) — destrava a resposta automática.
2. F-2 + F-3 (lead, valor e Ganho na compra) — depende de D-1, D-2, D-3.
3. F-4 (progresso no lead) — depende de D-6.

## 8. Plano de testes

Primeiro passo de cada fatia: **reproduzir o furo** antes de corrigir, já que o diagnóstico é só de leitura de código.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-18, CA-19, CA-20 | manual | Passo de texto com reserva, lead dentro e fora da janela; criar gatilho com template no modo rápido; lembrete para telefone da equipe em tracking Meta Cloud (não envia) e Uazapi (envia) |
| CA-16, CA-17 | manual | Tracking Meta Cloud: conversar com a IA do chat; deixar a automação de inatividade disparar com o lead dentro e fora da janela; confirmar um agendamento |
| CA-13, CA-14, CA-15 | manual | Passo Template num tracking Meta Cloud com lead fora da janela; o mesmo nó num tracking Uazapi; variável `{{email}}` em lead sem e-mail |
| CA-1, CA-3 | manual | Tracking de teste com instância Meta Cloud; rodar o workflow pelo "Testar passo-a-passo" e conferir o histórico |
| CA-2 | automatizado, se houver runner; senão script em `scripts/` | Mesmo payload antes e depois num tracking Uazapi |
| CA-4, CA-5, CA-8 | script em `scripts/dev-integration-check.ts` (padrão já usado) | Simular webhook do Stripe para o fluxo público, duas vezes; contar leads e lançamentos |
| CA-6, CA-7 | script + manual | Compra em modo teste do Stripe; conferir Detalhes do lead antes e depois do pagamento |
| CA-9, CA-10 | manual | Concluir aulas com um aluno de teste e abrir o lead |
| CA-11, CA-12 | manual | Criar o gatilho no modo rápido, inspecionar os nós, mandar "bom dia" e depois a frase do filtro |

Fechamento em produção: ligar a automação "Responder Interesse no Curso" da Pleno Car (trocando
a "Decisão da IA" pelo filtro) e fazer um teste real ponta a ponta com o número do Weydson.

## 9. Riscos e rollback

- **Envio em massa indevido**: um erro em RF-1 ou RF-10 pode fazer workflows responderem a mensagens que não deviam, num número oficial (risco de bloqueio pela Meta). Mitigação: CA-2 e CA-12; ativar primeiro só no tracking da Pleno Car.
- **Ganho indevido em cursos existentes**: mitigado por D-3 (opção desligada por padrão nos cursos atuais).
- **Lead duplicado**: a normalização de telefone (RF-7) pode casar leads que antes não casavam. É o efeito desejado, mas vale conferir numa cópia dos dados antes.
- **Efeito colateral dentro de transação**: reintroduzir o problema da regra 18 ao mexer no resgate. Conferir antes de commitar.
- **Rollback**: cada fatia é um PR independente e reversível. As migrations previstas só adicionam colunas com padrão — reversíveis sem perda. A configuração de produção da seção 1.2 se desfaz na tela (funil do curso voltar para COMERCIAL / Em atendimento; apagar a automação inativa).

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-08 | Weydson | Criada a partir da configuração da jornada da Pleno Car |
| 2026-10-08 | João | Fatia 1 (F-1) implementada: executores de envio pela porta de provedores. Template deixou de ser não-objetivo (RF-11, CA-13–15, D-9); janela conferida antes do envio (RF-12, D-8). F-5 e fatias 2–3 seguem pendentes. **Não validado em runtime** — CA-1, CA-2, CA-3 e CA-13–15 ainda precisam de teste manual |
| 2026-10-08 | João | RF-13: demais envios automáticos (inatividade, agenda, formulário, lembretes, IA do chat, Astro, workspace, notificação administrativa) pela porta de provedores (CA-16, CA-17, CB-21–23). **Não validado em runtime** |
| 2026-10-08 | João | Decisões do João: template reserva (RF-14), template no modo rápido (RF-15), avisos internos sem template global (RF-16): o passo de workspace ganhou seletor de template do cliente; lembrete e notificações não são enviados na API Oficial e ficam pendentes; botões/listas ficam para depois. CA-18–20, CB-24–26, D-11. **Não validado em runtime** |
| 2026-10-09 | Weydson | Seção 1.4: achados em produção. F-1 validado em runtime (CA-1) com lead real; novos furos F-6 (remetente de e-mail não autorizado), F-7 (e-mail sem campo de destinatário), F-8 (condição vazia na montagem por descrição), F-9 (execução SUCCESS com passo FAILED), F-10 (IA desativada bloqueia gatilhos sem aviso). Ainda sem requisitos nem critérios de aceite — a priorizar |
