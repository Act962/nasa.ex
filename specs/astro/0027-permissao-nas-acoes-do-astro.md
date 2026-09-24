# 0027 — Permissão nas ações e consultas do Astro

**Status**: implementada
**Autor**: Weydson
**Data**: 2026-09-24
**Peso**: completa

## 1. Problema

O Astro já sabia criar, mover e **apagar**, e já alcançava o financeiro — e a
única pergunta que ele fazia antes de agir era "é membro da organização?".

A matriz que o Master configura em Settings › Permissões
(`OrgPermission`: organização × role × app, com `canView/canCreate/canEdit/
canDelete`) era lida em **dois** lugares no servidor inteiro. O cliente a
respeita (`useCheckPermission`); o servidor, fora do financeiro, não.

Com o Astro virando um caminho a mais para tudo, isso deixa de ser detalhe: um
caminho a mais sem gate é um atalho para burlar o gate. O vazamento mais
concreto era a leitura — "quanto tenho a receber" respondia com valores a
qualquer membro.

## 2. Decisão

**Paridade.** O Astro lê a mesma matriz da tela. Não libera o que a tela nega,
não nega o que a tela libera. As telas e procedures existentes não mudam — o
Astro é alternativa, não substituto.

- `src/features/permissions/lib/catalog.ts` — catálogo de apps, papéis e
  padrões, tirado de `get-permissions.ts` (que passa a importar de lá). Uma
  fonte, dois leitores.
- `src/features/permissions/server/resolve-org-permissions.ts` — o caminho de
  servidor que faltava: `resolveOrgPermissions`, `isOrgActionAllowed`,
  `listPermissionGrantersNames`.
- `src/features/astro/actions/permission-gate.ts` — gate com cache por
  `AgentContext`, no mesmo desenho de `tools/finance/access.ts`.

**D-1 — Gate antes de tudo.** A checagem roda antes do ensaio (`dryRun`), antes
da confirmação e antes de perguntar o que falta. Perguntar o nome do lead para
só então recusar a exclusão desperdiça o tempo de quem não podia mesmo.

**D-2 — `OrgPermission` é override, não allow-list.** Linha ausente significa
"usa o padrão da role", não "proibido". É a semântica que `get-permissions.ts`
já usava; inverter isso trancaria a plataforma inteira.

**D-3 — Papel fora do catálogo não vira acesso.** `Member.role` é string livre
no banco. Role desconhecida resolve `null` — nega, não cai em padrão.

**D-4 — A recusa explica e diz a quem pedir** (decisão do dono do produto):
*"Você não tem permissão para excluir em Tracking / CRM. Quem libera é ⟨nome⟩,
em Configurações › Permissões."* Nomeia os owners, que são quem de fato altera
a matriz (`update-permission.ts`).

**D-5 — Destrutivo exige `canDelete`.** Apagar lead, arquivar tracking e
cancelar compromisso não passam por `create` nem por `edit`. Verificado por
teste, não por convenção.

**D-6 — Leitura barrada não vira resposta pela porta dos fundos.** Consulta sem
`canView` não roda e o pedido segue o fluxo normal, onde o orquestrador tem o
próprio gate — em vez de devolver número que a tela esconderia.

## 3. Critérios de aceite

- **CA-1** — toda ação do registro declara `permission` com `appKey` do
  catálogo; toda consulta declara `appKey`; destrutiva exige `canDelete`
- **CA-2** — pedido sem permissão devolve recusa **e o registro continua no
  banco** (o teste confere a linha, não só a mensagem)
- **CA-3** — a recusa nomeia quem libera e não vaza vocabulário de banco
- **CA-4** — sem `canView` em `financeiro`, a consulta financeira não responde;
  quem não é membro não lê nada
- **CA-5** — quem já podia continua podendo: `verify-astro-routing` e
  `verify-astro-queries` seguem verdes

Verificados por `scripts/verify-astro-permissions.ts` — 16 checagens, 0 falhas,
incluindo a matriz pura das quatro roles e o override revogando só o app dele.

## 4. Fora de escopo

As procedures oRPC fora do financeiro continuam sem ler `OrgPermission`: a tela
esconde o botão, a API responderia. É anterior ao Astro e é trabalho de
auditoria — registrar em `docs/seguranca-auditoria-2026-08.md`.

Aprovar/pagar (`canApprove`/`canPay`) segue eixo separado, via
`canUserApprovePayment`. Nenhuma ação do Astro aprova pagamento hoje.

## 5. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-24 | Weydson | Criada e implementada. A composição da org de teste (todos owners) não exercia a recusa; o caminho passou a ser verificado com quem não é membro, que atravessa o mesmo gate |
