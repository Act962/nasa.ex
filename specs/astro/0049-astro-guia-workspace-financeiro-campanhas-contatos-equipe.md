---
id: 0049
titulo: Astro Guia em Workspace, Financeiro, Campanhas, Contatos e Equipe
dominio: astro
status: em-revisao
autor: Weydson
criada: 2026-09-30
atualizada: 2026-09-30
branch: feature/W-astro-guias-outros-apps-20260930
pr:
peso: leve
---

# 0049 — Astro Guia em Workspace, Financeiro, Campanhas, Contatos e Equipe

> Continua a [0048](0048-astro-guia-em-outros-apps.md). Mesmo motor, sem mudança nele.

## 1. Contexto

Depois de Tracking, Chat, Agenda, Forge e Formulários, os pedidos de ajuda mais
comuns são de Workspace, Financeiro, Campanhas, Contatos e convite de membros.
O mapeamento e o teste acharam dois defeitos em `/contatos`: o botão
"Adicionar novo lead" (e o item "Novo lead" do menu no celular) não tinha ação
nenhuma, e o campo "Buscar contato" não abria a busca.

## 2. Objetivo

Nove guias novos nesses cinco apps, e o botão de novo lead de `/contatos`
funcionando.

### Não-objetivos

- Guia do disparo completo (modelo, destinatários, pagamento da taxa, envio):
  o guia cria a campanha e o cartão final explica os próximos passos.
- Guia de permissões por papel.
- Liberar o Financeiro para quem não está na lista de acesso (spec 0007).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Guias: Workspace (criar workspace, criar ação), Financeiro (lançar a receber, lançar a pagar, dar baixa), Campanhas (criar campanha), Contatos (cadastrar, encontrar), Equipe (convidar membro). |
| RF-2 | Em `/contatos`, "Adicionar novo lead" (desktop) e "Novo lead" (menu do celular) abrem o `AddLeadSheet`. |
| RF-3 | `AddLeadSheet` sem `trackingId` mostra um Select de tracking no topo; status, etiquetas e o lead usam o tracking escolhido. Com `trackingId` (board), nada muda. |
| RF-4 | Criado por `/contatos`, o lead invalida as consultas de `leads` para a lista atualizar. |
| RF-4b | O campo "Buscar contato" de `/contatos` abre a janela de busca. Antes não abria: `useSearchModal` é estado local, e a janela estava montada em outro componente (`HeadingContacts`) com outro estado. A janela passou para `SegmentsHeader`, junto do campo. |
| RF-4c | No formulário de novo lead, o Select de status é controlado (`value`, não `defaultValue`), para mostrar o status definido depois de escolher o tracking. |
| RF-5 | Avisos de conclusão novos: `workspace.created`, `action.created`, `payment.receivable-created`, `payment.payable-created`, `payment.registered`, `broadcast.created`, `member.invited`. |
| RF-6 | `missingMessage` específica onde o alvo pode não existir: Financeiro sem acesso, Campanhas sem número oficial, convite sem permissão (só dono/moderador), baixa sem conta em aberto. |

## 4. Critérios de aceite

- [x] **CA-1** — As 39 frases de teste (novas e antigas) caem no guia certo; ordens diretas ("lança 500 a receber do João") seguem fora.
- [x] **CA-2** — Em `/contatos`, "Adicionar novo lead" abre o formulário com o Select de tracking; criar o lead fecha o guia com "Abrir ficha".
- [x] **CA-3** — No board do tracking, o formulário de novo lead continua sem o Select de tracking.
- [x] **CA-4** — Guia "Lançar conta a pagar" abre `/payment?tab=payables` e termina ao salvar; lançar uma receita no meio não o encerra.
- [x] **CA-5** — Guia "Dar baixa" abre o menu da conta em aberto, o item "Registrar pagamento" aparece por cima do escurecido e o guia termina ao confirmar.
- [x] **CA-6** — Guia "Criar ação" termina ao criar a ação; "Criar workspace" termina com "Abrir workspace".
- [x] **CA-7** — Sem número oficial, o guia de campanha mostra a mensagem de conectar o WhatsApp oficial.
- [x] **CA-8** — `pnpm guides:check` passa com os 22 guias.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Usuário fora da lista do Financeiro | O botão não existe (gate substitui a tela) → cartão com `missingMessage` de acesso. |
| CB-2 | Nenhuma conta em aberto no mês | Menu da conta não aparece → cartão sugere conferir o período ou lançar antes. |
| CB-3 | Várias contas em aberto; a que foi paga não é a primeira | O passo destaca a tabela inteira; o usuário abre o menu de qualquer conta e o guia avança ao ver "Registrar pagamento". |
| CB-4 | Financeiro no celular (tabela vira cards) | Menu da tabela escondido → "Não encontrei" (elemento sem tamanho conta como ausente, 0048 CB-6). |
| CB-5 | Membro sem permissão de convite | Botão não renderiza → `missingMessage` explica que só dono/moderador convida. |
| CB-6 | Formulário de lead em `/contatos` sem tracking escolhido | Salvar mostra "Escolha o tracking do lead" e não envia. |

## 9. Riscos e rollback

Fora dos guias, mudam três coisas de tela: o botão e a busca de `/contatos`
(RF-2/RF-4b) e o Select de status controlado (RF-4c). `AddLeadSheet` segue
idêntico quando recebe `trackingId`, que é o caso do board. Rollback: voltar o
botão e a janela de busca ao lugar anterior e tornar `trackingId` obrigatório de novo.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-30 | Weydson | Criada |
| 2026-09-30 | Weydson | CA-1 a CA-8 conferidos no navegador (org ASTRO QA). "Encontrar contato" passou a terminar só ao abrir um contato (`contact.opened`), não em qualquer clique na janela — esta última mudança ainda sem build. Convite testado até o e-mail, sem enviar. |
| 2026-09-30 | Weydson | Teste no navegador: busca de `/contatos` não abria (RF-4b); status do formulário aparecia vazio (RF-4c); "Dar baixa" abria sempre a aba Receita e só deixava pagar a primeira conta — agora pede a aba e destaca a tabela inteira, avançando quando o menu de qualquer conta abre. |
