---
id: 0059
titulo: Comments nativo em cada post do Planner
dominio: nasa-planner
status: implementada
autor: Weydson
criada: 2026-10-04
atualizada: 2026-10-04
branch: feature/W-orbita-melhorias-ui-ux-2-20261004
pr:
peso: leve
---

# 0059 — Comments nativo em cada post do Planner

## 1. Contexto

O Comments responde comentários e manda DM no Instagram, mas é configurado longe do conteúdo: quem programa o post precisa abrir outro App depois que ele sai, achar o post na lista e montar a automação. O Planner não mostra se um post tem automação.

## 2. Objetivo

No próprio post do Planner, a pessoa vê se há automação do Comments, como ela está configurada, e cria/edita/liga/desliga — inclusive **antes** de o post sair; a automação passa a valer sozinha quando a publicação acontece.

Fora do escopo: o editor completo do Comments (fluxo com ramificações, botões múltiplos em canvas); DMs (só comentários); posts publicados fora do Planner.

## 3. Requisitos

- **RF-1** `NasaPlannerPost.commentsAutomationId` liga o post a uma `SocialAutomation` da mesma org; `commentsAutoActivate` guarda se ela deve ser ligada quando o post sair.
- **RF-2** Status por post (`nasaPlanner.comments.get`): canal do Comments da org (conectado, ativo, mesma conta do Instagram do post?), automação ligada ao post (palavras-chave, DM, respostas públicas, ativa?) e automações "em todos os posts" (ALL_CONTENT) que também vão atuar.
- **RF-3** Salvar (`nasaPlanner.comments.save`) com campos simples: responder a qualquer comentário ou só a palavras-chave; palavras para ignorar; texto da DM (com até 1 botão de link); respostas públicas (até 5); ligar/desligar. Cria a automação na primeira vez (nome "Planner: <título>") com gatilho COMMENT_CREATED + SPECIFIC_CONTENT.
- **RF-4** Post ainda não publicado: a automação fica desligada e sem alvo; ao publicar (`afterPublished` do fluxo da spec 0057), o media id do Instagram vira alvo e ela é ligada se `commentsAutoActivate`.
- **RF-5** Post já publicado: o alvo é o `externalIgPostId` e ligar acontece na hora (regra de prontidão do Comments vale).
- **RF-6** Calendário mostra um selo no post que tem automação (ligada ou para ligar ao publicar).
- **RF-7** Permissão: editar exige `canCreate` no Planner da org do post **e** o App Comments liberado para o usuário (`canEdit` em `comments`).

## 4. Critérios de aceite

- **CA-1** Post programado com automação "palavra: quero → DM" → ao publicar, a automação ganha o media id como alvo e fica ativa.
- **CA-2** Org sem canal do Comments conectado → o painel mostra "Conecte o Instagram no Comments" e não deixa salvar.
- **CA-3** Canal conectado em outra conta do Instagram que não a do post → aviso claro, salvar bloqueado.
- **CA-4** Desligar no Planner desliga no Comments (e vice-versa aparece no Planner).
- **CA-5** Automação ALL_CONTENT ativa na org aparece como "também vale para este post".

## 5. Casos de borda

- **CB-1** Automação apagada no Comments → o vínculo some (`SetNull` lógico: o painel trata id inexistente como "sem automação" e limpa o campo).
- **CB-2** Falha ao ligar a automação depois de publicar → a publicação continua PUBLISHED; o erro fica registrado no log e o painel mostra a automação desligada.
- **CB-3** Post despublicado/apagado → a automação continua no Comments (não é apagada automaticamente).

## 9. Riscos e rollback

Migration aditiva (duas colunas nulas/default). Rollback: esconder o painel; as automações criadas continuam válidas no Comments.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-04 | Weydson | Criada (Fase 2) |
| 2026-10-04 | Weydson | Implementada; migration `20261004230000_planner_comments_link` aplicada. |
