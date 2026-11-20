---
id: 0152
titulo: Permissões por usuário (exceção sobre o papel)
dominio: permissions
status: implementada
autor: Weydson
criada: 2026-11-20
atualizada: 2026-11-20
branch: feature/W-star-friends-modo-pontos-20261109
pr: Act962/nasa.ex#502
peso: leve
---

# 0152 — Permissões por usuário

## 1. Contexto

Configurações › Permissões já tem a matriz por **papel** (Master, Adm, Single, Moderador × app × ver/criar/editar/excluir, mais aprovar/pagar em alguns apps), gravada em `OrgPermission` e conferida no servidor por `getUserAppPermissions`/`resolveOrgPermissions` (~30 pontos) e no cliente por `useCheckPermission`. Não dá para tratar uma pessoa diferente das outras do mesmo papel: para tirar o Financeiro de um único Single, hoje é preciso tirar de todos.

Decisão do Weydson (20/11/2026): botão de edição ao lado de cada usuário, onde o Master escolhe quais apps a pessoa vê e o que pode fazer em cada um. Pediu na mesma PR 502, ciente do risco (ver "Dívida assumida" na PR).

## 2. Objetivo

O Master abre a pessoa, liga e desliga apps e ações, e isso vale para ela no menu, nas telas e no servidor, sem mudar o papel dos outros.

### Não-objetivos

- Bloquear por URL os apps que hoje não conferem permissão no servidor. Esconder do menu é o que esta spec entrega; cada app continua com a conferência que já tem.
- Permissões por tracking, por funil ou por registro.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Ícone de edição ao lado de cada membro (menos o Master) na lista de participantes, visível só para o Master. |
| RF-2 | Janela "Permissões de {nome}": todos os apps do catálogo, com Ver, Criar, Editar, Excluir (e Aprovar/Pagar onde existem). Cada app mostra se segue o papel ou está personalizado, com "Voltar ao padrão do papel". |
| RF-3 | Ordem de resolução: Master sempre pode tudo → exceção da pessoa → exceção do papel na org → padrão do papel. |
| RF-4 | A exceção vale no servidor (`getUserAppPermissions`, `resolveOrgPermissions`, que o Astro e as procedures usam) e no cliente (`useCheckPermission`). |
| RF-5 | App com "Ver" desligado some do menu lateral e do lançador de Apps para a pessoa (vale também para o papel). |
| RF-6 | Só o Master (role `owner`) altera; o servidor recusa os demais e recusa editar um Master. |
| RF-7 | Remover a pessoa da empresa apaga as exceções dela nessa empresa. |
| RF-8 | Cada alteração fica no histórico de atividade da org (`permission_member_updated`). |

## 4. Critérios de aceite

- [ ] **CA-1** — Master desliga "Ver" do Financeiro para um Single: o Financeiro some do menu desse Single e continua para os outros Singles.
- [ ] **CA-2** — Single com exceção tenta a rota do Financeiro que já confere permissão: recusada.
- [ ] **CA-3** — Adm chama a rota de salvar exceção: FORBIDDEN.
- [ ] **CA-4** — Master passa um `userId` de outra empresa: NOT_FOUND.
- [ ] **CA-5** — "Voltar ao padrão do papel" apaga a exceção daquele app.

## 9. Riscos e rollback

- **Mudança de comportamento:** app com "Ver" desligado no papel (configurado antes por algum Master) passa a sumir do menu. Hoje todos os padrões têm "Ver" ligado; só muda para quem já desligou de propósito.
- **Rollback:** apagar as linhas de `member_app_permission` volta tudo ao papel. A tabela pode ficar.

### Segurança

- Rotas com `requireOrgMiddleware`, conferência de Master no servidor e do `userId` como membro da org (CA-3, CA-4).
- `getPermissions` só devolve as exceções de todos para o Master; os demais recebem só as próprias.

### Impacto

- Tabela nova `member_app_permission` (org, usuário, app, 6 booleanos), única por (org, usuário, app), índice (org, usuário), `onDelete: Cascade` na org e no usuário. Volume: no máximo membros × ~30 apps por org. Não cabe em `OrgPermission` porque a chave única dela é por papel.
- Sem Inngest, sem variável de ambiente.

## 10. Changelog da spec

- 2026-11-20: criada e implementada na PR 502 a pedido do Weydson.
