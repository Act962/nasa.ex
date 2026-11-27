---
id: 0153
titulo: "Ver" de cada app vale no menu, na página Apps e pela URL
dominio: permissions
status: implementada
autor: João Gabriel
criada: 2026-11-24
atualizada: 2026-11-24
branch: feature/permissions-fix-moderador-escalation-20261124
peso: leve
---

# 0153 — "Ver" de cada app vale em todo lugar

## 1. Contexto

A matriz de Configurações › Permissões (papel, spec 0152 por pessoa) tem "Ver" por app, mas até aqui ele só tirava o item do menu lateral, e só de 16 apps. Formulários nunca sumia (o item do menu se chama `cosmic` e ficou fora do mapa), Astro, Comments e Nerp continuavam no lançador "Apps do Órbita", a página Apps mostrava tudo, e quem tinha o endereço abria qualquer app. Campanhas, trafeGO, Astro Chat e FlowAstro nem tinham chave na matriz.

## 2. Objetivo

Com "Ver" desligado, o app some do menu, do lançador e da página Apps e não abre pela URL (volta ao Início). É o primeiro passo; criar, editar e excluir nas procedures ficam para outra spec.

### Não-objetivos

- Conferir permissão nas procedures (`/api/rpc`) dos apps que ainda não conferem.
- Esconder links para o app dentro de outras telas (ex.: atalhos no Início).

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Chaves novas na matriz: `campanhas`, `trafego`, `astro-chat`, `flowastro`. Nascem com o padrão do papel ("Ver" ligado para todos). |
| RF-2 | Um mapa único (`features/permissions/lib/app-view-keys.ts`) liga cada app (item do menu e card de /apps) às chaves que liberam o "Ver". Basta uma chave com "Ver". Gatilhos Automáticos aparece se a pessoa vê qualquer tipo de automação (mesmo critério do painel). |
| RF-3 | Menu lateral, lançador "Apps do Órbita" e página Apps (cards e contadores) leem o mapa. Enquanto as permissões carregam, nada some. |
| RF-4 | O layout de cada app chama `requireAppView`: sem "Ver", redireciona para `/home` antes de a tela carregar. No Route, só a área do criador (`/nasa-route/criador`) é bloqueada; cursos, checkout e certificados seguem abertos para quem é aluno. |
| RF-5 | Empresa de escopo restrito (`Organization.appScope`) nunca é bloqueada no próprio app do escopo, para não haver redirecionamento sem fim com o `TrafegoScopeGuard`. |
| RF-6 | O Master vê tudo, sempre. |

## 4. Critérios de aceite

- [ ] **CA-1** — Single com "Ver" do Formulários desligado: some do menu e da página Apps; `/form` volta ao Início.
- [ ] **CA-2** — Single com "Ver" do Comments desligado: some do lançador e da página Apps; `/comments` volta ao Início.
- [ ] **CA-3** — Single sem nenhuma automação visível: Gatilhos Automáticos some e `/gatilhos` volta ao Início.
- [ ] **CA-4** — Master com tudo desligado no papel dele continua vendo e abrindo todos os apps.
- [ ] **CA-5** — Nenhuma configuração alterada: todos continuam vendo os mesmos apps de antes do deploy.

## 9. Riscos e rollback

- **Mudança de comportamento:** quem já teve "Ver" desligado por um Master (no papel ou na pessoa) passa a ser barrado também pela URL. É o que a tela promete.
- **Custo:** cada entrada num app faz a leitura da sessão e 3 consultas leves (papel, exceções do papel, exceções da pessoa). Navegação dentro do mesmo app não repete.
- **Rollback:** reverter o PR. Sem migration, sem tabela, sem variável de ambiente.

## 10. Changelog da spec

- 2026-11-24: criada e implementada.
