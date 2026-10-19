---
id: 0114
titulo: Origem real do lead na Jornada — de onde a pessoa veio, não só por onde ela fala
dominio: leads
status: em-revisao
autor: Weydson (com Claude)
criada: 2026-10-19
atualizada: 2026-10-19
branch: feature/W-gatilhos-tags-do-chat-20261017
pr:
peso: completa
---

# 0114 — Origem real na Jornada

Amplia a [0105](0105-canal-de-origem-do-lead.md): a 0105 resolveu o **canal** (por onde a pessoa conversa); esta resolve a **origem** (de onde ela veio). Faz parte do plano da [0113](../tracking-chat/0113-estado-de-atendimento.md) (fase 4).

## 1. Contexto

Levantamento de 19/10/2026:

- O botão de QR do Linnker, o ícone de WhatsApp das redes, os links de chat do Linnker e o botão flutuante das Pages abrem `wa.me`. Quando a primeira mensagem chega, o lead nasce como `WHATSAPP` (`persist-canonical-inbound.ts:494`), sem nenhuma ligação com a página. Resultado: a Jornada mostra "WhatsApp" para quem veio do Linnker ou do site.
- A rota `/l/<slug>/wa` já grava um `LinnkerScan` antes de redirecionar, mas sem telefone e sem lead; `matchScanToLead` existe e nunca é chamada.
- `NasaPageVisit` não grava o clique no WhatsApp: o botão flutuante fica fora do rastreador de cliques.
- O formulário embutido nas Pages manda as UTMs em camelCase (`utmSource`) e o formulário só lê `utm_source`: o lead do site perde a campanha.
- O trafeGO cria o lead como `OTHER` e só escreve a origem num texto da descrição.
- O kind `lead_origin` já existe na Jornada, só da equipe, mas ninguém grava.

## 2. Objetivo

A Jornada diz de onde o lead veio de verdade ("Origem: Linnker "Bio Pleno Car" · conversou pelo WhatsApp"), com campanha e anúncio quando houver, sem tabela nova.

### Não-objetivos

- Relatório de origem no Insights (fica para depois, lendo o mesmo evento).
- Mudar o enum `LeadSource` ou o `source` de leads antigos (sem migration, sem backfill).
- Identificar visitante entre dispositivos ou guardar IP novo.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | A origem é gravada **uma vez**, na criação do lead, como evento `lead_origin` da Jornada: `{ origin, sourceName, sourceId, channel, matchedBy, confidence, utm, ad }`. `origin` ∈ `WHATSAPP` (sem pista), `LINNKER`, `PAGES`, `TRAFEGO`, `META_ADS`, `FORM`, `AGENDA`, `SITE_CHAT`, `IN_CHAT`, `INSTAGRAM_DIRECT`, `INSTAGRAM_COMMENT`, `FACEBOOK`, `CATALOG`, `CAMPANHA`, `API`, `MANUAL`, `IMPORT`. |
| RF-2 | **Código de origem**: cada página do Linnker e cada site das Pages tem um código fixo curto, derivado do id (`L` + 4 caracteres para Linnker, `P` + 4 para Pages). Os botões de WhatsApp dessas páginas acrescentam "(cód. XXXXX)" à mensagem pronta. |
| RF-3 | Passam pelo código e pelo registro do clique: o botão de QR e o ícone de WhatsApp das redes do Linnker (pela rota `/l/<slug>/wa`), os links de chat do Linnker que apontam para `wa.me`/`api.whatsapp.com` e o botão flutuante das Pages. O clique no WhatsApp das Pages vira visita `_evt:whatsapp_click`. |
| RF-4 | Lead novo pelo WhatsApp: (a) com referência de anúncio da Meta → `META_ADS`, certo; (b) com código na primeira mensagem de uma página **da mesma empresa** → `LINNKER`/`PAGES`, certo, e o clique daquela página sem lead nos últimos 30 min passa a apontar para o lead; (c) sem código, se houve **um único** clique de WhatsApp nas páginas da empresa nos últimos 15 min → a página, **provável**; (d) senão → `WHATSAPP`. |
| RF-5 | Demais entradas gravam a origem conhecida: formulário (com nome do formulário e UTMs), captura do Linnker, agenda pública, chat do site, In-Chat, trafeGO (com "conheceu por"), API externa, cadastro manual, importação, campanha e catálogo. |
| RF-6 | O formulário embutido nas Pages repassa as UTMs no formato `utm_*` que o formulário lê. |
| RF-7 | A Jornada mostra a origem no cartão do topo: rótulo, nome da página/formulário/campanha, "conversou pelo <canal>", campanha (`utm_source`/`utm_medium`/`utm_campaign`), anúncio e página de entrada. "Provável" aparece quando a ligação foi por horário. Lead sem `lead_origin` segue com a regra da 0105. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Sem tabela nova e sem migration. O código é calculado do id (função pura, sem coluna). |
| RNF-2 | A busca de origem roda só na criação do lead, com consultas limitadas às páginas da empresa e à janela de 15–30 min. Mensagens seguintes não consultam nada. |
| RNF-3 | Falha ao gravar a origem nunca impede a criação do lead nem a mensagem (melhor esforço, fora de transação). |

## 4. Critérios de aceite

- [ ] **CA-1** — Cliente lê o QR do Linnker "Bio Pleno Car" e manda a mensagem pronta → lead novo com "Origem: Linnker "Bio Pleno Car" · conversou pelo WhatsApp" e a leitura do QR aparece na Jornada.
- [ ] **CA-2** — Cliente apaga o código da mensagem, mas foi o único clique dos últimos 15 min → mesma origem, marcada "provável".
- [ ] **CA-3** — Dois cliques de páginas diferentes nos últimos 15 min e mensagem sem código → origem `WHATSAPP` (não chuta).
- [ ] **CA-4** — Botão flutuante de WhatsApp de um site das Pages → "Origem: Site "<nome>"".
- [ ] **CA-5** — Formulário embutido numa página com `?utm_source=instagram&utm_campaign=promo` → o lead guarda a campanha e a Jornada mostra.
- [ ] **CA-6** — Lead do trafeGO → "Origem: trafeGO", com o "conheceu por".
- [ ] **CA-7** — Lead com referência de anúncio da Meta → "Origem: Anúncio da Meta", com o título do anúncio.
- [ ] **CA-8** — Código de página de outra empresa na mensagem → ignorado.
- [ ] **CA-9** — Lead antigo (sem `lead_origin`) aparece como hoje.
- [ ] **CA-10** — A página pública do lead não mostra a origem.

## 5. Casos de borda

| ID | Situação | Comportamento |
| --- | --- | --- |
| CB-1 | Lead que já existia escreve de novo pelo Linnker | Origem não muda (é de quem chegou); o clique fica sem lead. |
| CB-2 | Mesmo cliente clica duas vezes no QR | Único **visitante** não é garantido; dois cliques da mesma página contam como um para o "único clique" (a página é a mesma). |
| CB-3 | Mensagem pronta editada no WhatsApp | O código pode sumir: cai na regra de horário. |
| CB-4 | Página do Linnker sem telefone de WhatsApp nas redes | A rota `/wa` já trata; nada muda. |
| CB-5 | Lead criado pelo chat de outro canal (Instagram/Facebook) | Origem = o canal; anúncio quando houver referência. |

## 6. Decisões de design

### D-1 — Código derivado do id, não coluna nova
FNV-1a do id da página em base 32, 4 caracteres, com prefixo do produto. Colisão dentro de uma empresa é rara e, se houver, cai na regra de horário. Descartado: coluna `originCode` (exigiria migration e preenchimento).

### D-2 — Evento na Jornada, não campo no lead
`lead_origin` guarda o detalhe sem mexer no `source` (que já move filtros, In-Chat e janela da Meta). Descartado: novos valores no enum (migration e efeito nos filtros).

### D-4 — Janela de tempo pela chave primária
`LinnkerScan` e `NasaPageVisit` não têm índice por data, e cada visita do Linnker gera uma linha. Os ids são cuid v1 (`c` + data em base 36), então "últimos 15 min" vira `id >= c<data>`: intervalo da chave primária, sem migration. Descartado agora: índice `(pageId, createdAt)` (exige migration; fica como melhoria se o custo aparecer).

### D-3 — Horário só com clique único
Ligar por horário quando há mais de um clique viraria chute. "Provável" deixa claro para a equipe.

## 7. Segurança de dados

- `lead_origin` é só da equipe (fora da página pública do lead, que devolve o metadata).
- O código não revela nada da página (hash curto do id) e só vale contra páginas da empresa do lead.
- Nenhum dado pessoal novo: IP e navegador não passam a ser gravados onde não eram.

## 8. Regras da Meta

- A mensagem pronta é enviada pelo próprio cliente; o código no texto não é mensagem da empresa nem proativa.
- Nenhum envio novo ao cliente.

## 9. Riscos e rollback

- A mensagem pronta ganha "(cód. XXXXX)": a equipe pode estranhar; o texto do dono continua na frente.
- Rollback: remover o sufixo dos botões; a Jornada volta à regra da 0105 para leads sem evento.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-19 | Weydson (com Claude) | Criada a partir da fase 4 do plano aprovado da 0113 e do levantamento de entradas de lead. |
| 2026-10-19 | Claude | Implementação: `features/leads/lib/lead-origin/` (código, gravação e origem do WhatsApp). Código em `(cód. XXXXX)` no QR e no ícone/links de chat do Linnker e no botão flutuante das Pages; clique registrado como `LinnkerScan.scanKind = "whatsapp_link"` e visita `_evt:whatsapp_click`. Origem gravada no WhatsApp (oficial e Uazapi), formulário (envio e rascunho), Linnker, agenda pública, chat do site, In-Chat/catálogo, trafeGO, API, cadastro manual, campanha, Instagram e Facebook. Fora: importação de planilha e carteira do ERP (criam em lote; seguem pela regra da 0105). O cartão escreve "Origem: …" em vez de "Veio do …" (preposição muda por origem). |
| 2026-10-19 | Claude | Revisão da fase 4: conversa aberta pela equipe pelo celular vira origem "cadastro manual" (não pega clique de visitante); formulário embutido lê as UTMs depois de montar (na hidratação o `src` do servidor ficava sem elas); liga ao lead exatamente o clique encontrado e só clique de WhatsApp (não a visita); clique do site já usado por um lead depois dele não rotula outro; clique do site enviado com o id da página (slug de subpágina repete entre empresas); colisão de código não chuta; links `wa.me` sem `https://`, `whatsapp://send` e ícone só com telefone ganham o código; rascunho e prévia sem código; clique do Linnker por `sendBeacon`; "Visitas" do Linnker não contam o clique no WhatsApp; Jornada exige ser da empresa dona do funil; "(provável)" junto do nome. Limite conhecido: o clique não diz para qual número/funil o cliente foi; na empresa com vários números, a regra de horário pode ligar ao funil errado (fica "provável"). |
