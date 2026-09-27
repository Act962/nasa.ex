---
id: 0034
titulo: Detalhes do lead na lateral do chat e selo do canal no avatar
dominio: tracking-chat
status: aprovada
autor: Weydson
criada: 2026-09-26
atualizada: 2026-09-26
branch: feature/W-astro-commander-20260925
pr:
peso: leve
---

# 0034 — Detalhes do lead na lateral do chat e selo do canal no avatar

## 1. Contexto

Na conversa, o atendente precisava sair do chat e abrir `/contatos/[leadId]` para ver jornada, arquivos, formulários ou contratos do lead. Na lista de conversas, o canal de origem só aparecia num ícone pequeno no rodapé do card, fácil de perder.

## 2. Objetivo

Trazer os detalhes do lead para a própria conversa, numa lateral direita que abre e recolhe, e mostrar o canal no avatar da lista.

### Não-objetivos

- Star Friend: só o lugar na grade, com "em breve".

## 3. Requisitos

| ID | Requisito |
|---|---|
| RF-1 | O avatar do card da lista mostra o selo do canal no canto: Instagram e Facebook pelo canal da conversa; ASTRO CHAT, chat do site e e-mail pela origem do lead; WhatsApp nos demais. |
| RF-2 | A conversa ganha a lateral "Detalhes do Lead" (≥ lg): avatar, nome, apelido editável, copiar telefone, e-mail, histórico, última atividade; abas Informações (e-mail, telefone, responsável, observações) e Endereço. |
| RF-3 | Grade de itens com contador: Jornada, Arquivos, Formulários, Contratos, Documentos (propostas do Forge), Star Friend, Agenda, Campanhas e Comandos. Cada item abre a sua tela. |
| RF-4 | Recolhida, a lateral vira trilho de ícones com os mesmos itens e contadores. A escolha fica no navegador (`localStorage`). |
| RF-5 | Agenda lista os compromissos do lead e tem o calendário com o lead pré-preenchido; Campanhas lista os disparos recebidos; Comandos lista as execuções do ASTRO COMMANDER disparadas pelo lead (`triggerKey = lead:<id>`) e abre "Criar comando". |
| RF-7 | Endereço do lead salvo em 8 colunas opcionais de `leads` (CEP, logradouro, número, complemento, bairro, cidade, estado, país), editável campo a campo na aba "Endereço" — na lateral do chat e na página do contato (que antes tinha campos falsos, sempre vazios). Migração `20260926180000_lead_address`, só `ADD COLUMN` nulo. |
| RF-6 | As consultas novas (`leads.getChatSidebarSummary`, `listLeadAppointments`, `listLeadCampaigns`, `listLeadCommandRuns`) só respondem para lead da org de quem pede. |

## 4. Critérios de aceite

- [ ] **CA-1** (RF-1) — Conversa de Instagram mostra o selo do Instagram no avatar; lead do ASTRO CHAT mostra o selo do ASTRO.
- [ ] **CA-2** (RF-2, RF-4) — Recolher e recarregar a página mantém a lateral recolhida.
- [ ] **CA-3** (RF-3) — Os contadores batem com as telas (ex.: 3 arquivos no contador, 3 na tela).
- [ ] **CA-5** (RF-7) — Editar a cidade na lateral do chat e abrir a página do contato mostra a mesma cidade.
- [ ] **CA-4** (RF-6) — Pedir o resumo de um lead de outra org devolve NOT_FOUND.

## 5. Casos de borda

- Lead sem telefone ou e-mail: os botões avisam em vez de abrir nada.
- Tablet e celular (< lg): a lateral não aparece; a página do contato segue sendo o caminho.
- Lead sem nenhum item: os contadores não aparecem, e cada tela diz que está vazia.

## 9. Riscos e rollback

A migração é aditiva (colunas nulas); rollback do código não exige desfazê-la. Fora ela, só leitura e componentes novos; os campos de e-mail, telefone e responsável ganharam `leadId` opcional, com o comportamento antigo como padrão. Rollback: remover `<LeadSidebar>` da página da conversa.

## 10. Changelog da spec

| Data | Autor | Mudança |
|---|---|---|
| 2026-09-26 | Weydson | Criada. Endereço entrou no escopo (RF-7) por decisão do dono do produto: migração `20260926180000_lead_address` aplicada no Neon via `db execute` + `migrate resolve`. |
| 2026-09-26 | Weydson | Aprovada. Confirmado: "Documentos" são as propostas e orçamentos do Forge do lead. |
