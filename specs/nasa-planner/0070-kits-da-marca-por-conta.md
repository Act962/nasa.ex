---
id: 0070
titulo: Vários Kits da Marca por empresa, vinculados à conta do Instagram
dominio: nasa-planner
status: aprovada
autor: João Gabriel
criada: 2026-10-05
atualizada: 2026-10-05
branch: feature/comments-contas-instagram-satelites-20261005
pr: # empilhada sobre a PR 431
peso: completa
---

# 0070 — Vários Kits da Marca por empresa, vinculados à conta do Instagram

> Depende da [spec 0069](../comments/0069-contas-do-instagram-nos-satelites.md)
> (várias contas do Instagram por empresa).

---

## 1. Contexto

O Kit da Marca (spec 0063) é **um por empresa**. Ele não é uma tabela: é montado
de três lugares, todos com a empresa como chave.

| Onde | O que guarda |
| --- | --- |
| `Organization.brand*` | logos, cores, fontes, tom de voz, público, posicionamento, slogan, site |
| `NasaPlanner` padrão da empresa | nome da marca, frases, palavras proibidas, hashtags, CTAs |
| `BrandKitAsset` (por `organizationId`) | fundos, produtos, materiais, posts de referência |

Com a spec 0069 uma empresa pode conectar vários Instagrams. Uma agência que
mantém os perfis dos clientes na própria empresa hoje é obrigada a usar a mesma
marca em todos: mesmo logo, mesmas cores, mesmo tom de voz, mesmos produtos.
O "Gerar com o Astro" escreve o roteiro do cliente B com a voz do cliente A.

Ao mesmo tempo, há quem tenha vários perfis da **mesma** marca (matriz e
filiais) e queira um kit só para todos.

`Organization.brand*` também é a marca da empresa fora do Planner:
Configurações → Marca e a IA de outros apps (`buildBrandedContext`) leem os
mesmos campos.

## 2. Objetivo

Uma empresa mantém o kit padrão que já tem e pode criar kits adicionais; cada
conta do Instagram usa o kit padrão ou um kit específico, e o post herda o kit
da conta em que vai sair.

### Não-objetivos

- **Roteiro da semana, temas do dia, pilares e metas por marca.** Continuam por
  empresa; contas na mesma empresa seguem dividindo esses itens.
- **Escolher o kit em cada post.** O post sempre usa o kit da conta.
- **Separar o kit padrão da marca de Configurações → Marca.** Continuam sendo o
  mesmo dado.
- **Mexer nos campos de marca antigos por planner** (`NasaPlanner.toneOfVoice`,
  `primaryColors`, `logoLight`…), usados pela tela antiga de configurações e por
  `generate-post.ts`.
- **Kit por página do Facebook ou por outra rede.** Só contas do Instagram
  (`SocialChannel`) têm vínculo nesta spec.
- **Compartilhar um kit entre empresas.**

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Toda empresa tem o **kit padrão**: os dados de marca que já existem hoje, sem migração de conteúdo. Não pode ser apagado. |
| RF-2 | Quem pode criar no Planner da empresa cria **kits adicionais**, com nome próprio, começando vazio ou como cópia do kit padrão (identidade e listas de texto; arquivos de materiais não são copiados). |
| RF-3 | Um kit adicional tem os mesmos campos do padrão: logos, cores, fontes, voz, público, posicionamento, slogan, site, nome da marca, frases, palavras proibidas, hashtags, CTAs e as quatro listas de materiais. |
| RF-4 | Cada kit tem o próprio medidor de itens completos, com a mesma regra de hoje. |
| RF-5 | Na aba Kit da Marca, depois de escolher o cliente, o usuário escolhe o kit: "Padrão da empresa" ou um dos adicionais. A escolha fica na URL. |
| RF-6 | Cada kit mostra quais contas do Instagram o usam. |
| RF-7 | Owner e admin escolhem o kit de cada conta do Instagram, na aba Kit da Marca e no cartão da conta em Satélites › Instagram. Conta sem escolha usa o kit padrão. |
| RF-8 | O post usa o kit da conta do Instagram em que vai sair: "Gerar com o Astro", o checklist da marca na aprovação (palavras proibidas) e o painel do criador de conteúdo leem esse kit. |
| RF-9 | Post sem conta do Instagram definida, ou cuja conta não está conectada nos Satélites, usa o kit padrão. |
| RF-10 | Renomear e apagar kit adicional: quem pode criar no Planner. Apagar pede confirmação, mostra quantas contas o usam e devolve essas contas ao kit padrão. |
| RF-11 | A ferramenta do Astro no chat e as tools do MCP recebem a conta do Instagram como parâmetro opcional e devolvem o kit dela; sem o parâmetro, o padrão. A listagem de kits da empresa entra na resposta, com as contas de cada um. |
| RF-12 | O criador de conteúdo mostra de qual kit vem a marca em uso ("Kit: Cliente B"), com link para ele. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Configurações → Marca, `buildBrandedContext` e os demais leitores de `Organization.brand*` não mudam de comportamento. |
| RNF-2 | Migration só aditiva, sem reescrita de dados: roda no boot do container (CLAUDE.md, regra 24h). |
| RNF-3 | Teto de 20 kits adicionais por empresa, em constante nomeada. |
| RNF-4 | Toda leitura e escrita de kit confere que o kit é da empresa informada; todo vínculo confere que conta e kit são da mesma empresa. |

## 4. Critérios de aceite

- [x] **CA-1** — Dada uma empresa com o kit preenchido antes desta spec, quando abre a aba Kit da Marca, então vê "Padrão da empresa" com os mesmos dados e o mesmo medidor de antes.
- [x] **CA-2** — Dado o kit adicional "Cliente B" com tom de voz próprio, quando o usuário gera roteiro com o Astro para um post da conta vinculada a ele, então o prompt leva a voz, as cores e os produtos do "Cliente B", e nada do kit padrão.
- [x] **CA-3** — Dadas as contas A e B sem vínculo, quando geram conteúdo, então as duas usam o kit padrão.
- [x] **CA-4** — Dado o kit "Cliente B" incompleto e o padrão completo, quando o usuário tenta "Gerar com o Astro" num post da conta do "Cliente B", então é bloqueado com a lista do que falta **no kit do Cliente B**.
- [x] **CA-5** — Dado um post da conta do "Cliente B" com uma palavra proibida só no kit dele, quando vai para aprovação, então o checklist aponta a palavra; o mesmo texto num post de conta do kit padrão não é apontado.
- [x] **CA-6** — Dado o kit "Cliente B" usado por duas contas, quando é apagado, então as duas contas passam a usar o kit padrão e os materiais do kit apagado somem.
- [ ] **CA-7** — Dado o kit padrão, quando o usuário tenta apagá-lo, então a ação não existe na tela e a procedure recusa.
- [x] **CA-8** — Dado um kit de outra empresa, quando seu id é enviado a qualquer procedure de kit ou de vínculo, então a resposta é NOT_FOUND e nada é lido nem alterado.
- [x] **CA-9** — Dado o kit padrão editado na aba Kit da Marca, quando o usuário abre Configurações → Marca, então vê a alteração; e o inverso.
- [x] **CA-10** — Dado um kit adicional editado, quando o usuário abre Configurações → Marca, então nada mudou lá.
- [ ] **CA-11** — Dado um membro sem permissão de criar no Planner, quando abre um kit, então vê em modo leitura e as procedures de escrita devolvem FORBIDDEN.
- [x] **CA-12** — Dada uma empresa com 20 kits adicionais, quando tenta criar o 21º, então recebe a mensagem de limite.
- [x] **CA-13** — Dado "Criar como cópia do padrão", quando o kit nasce, então identidade e listas de texto vêm copiadas e as quatro listas de materiais vêm vazias.
- [x] **CA-14** — `pnpm guides:check` passa com as âncoras novas.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Post criado com a conta A (kit padrão) e depois trocado para a conta B (kit "Cliente B") | Passa a usar o kit do "Cliente B" dali em diante. Texto e roteiro já gerados não são refeitos; o checklist de aprovação roda com o kit novo. |
| CB-2 | Conta muda de kit com posts já programados | Os posts já escritos não mudam. Novas gerações e o checklist passam a usar o kit novo. |
| CB-3 | Conta do post está desativada nos Satélites | Continua resolvendo o kit pelo vínculo: desativar não apaga o vínculo. |
| CB-4 | Post só para Facebook, sem Instagram | Kit padrão (RF-9). |
| CB-5 | Post com conta do Instagram que só existe em `MetaPublishAccount` (login da Meta) e não foi conectada como conta nos Satélites | Kit padrão. O criador de conteúdo avisa que a conta precisa estar nos Satélites para ter kit próprio. |
| CB-6 | Empresa com várias contas e post ainda sem conta escolhida | Kit padrão, e o criador mostra "Kit: Padrão — escolha a conta para usar o kit dela". |
| CB-7 | Dois kits com o mesmo nome na empresa | Recusado na criação e na renomeação (unique por empresa, sem diferenciar maiúsculas). |
| CB-8 | Kit apagado enquanto alguém edita nele em outra aba | A gravação seguinte devolve NOT_FOUND e a tela volta para o kit padrão. |
| CB-9 | Duas pessoas vinculam a mesma conta a kits diferentes ao mesmo tempo | Vale a última gravação; a tela recarrega o vínculo depois de salvar. |
| CB-10 | URL da aba aponta para kit que não existe mais ou é de outra empresa | Cai no kit padrão do cliente escolhido e corrige a URL. |
| CB-11 | Material enviado para um kit adicional | Fica só nele. O kit padrão e os outros não o enxergam. |
| CB-12 | Chamada antiga do MCP ou do Astro sem informar a conta | Devolve o kit padrão, como hoje. Nenhum cliente existente quebra. |
| CB-13 | Empresa sem planner padrão ainda | `ensureDefaultPlanner` cria, como hoje; não afeta kits adicionais, que não dependem do planner. |

## 6. Decisões de design

### D-1 — O kit padrão continua onde está; só os adicionais ganham tabela

- **Escolha**: nova tabela `BrandKit` guarda **apenas os kits adicionais**. O kit
  padrão não tem linha: é o que `getBrandKit` já monta hoje a partir de
  `Organization.brand*`, do planner padrão e dos `BrandKitAsset` sem kit.
  "Sem kit" (`brandKitId` nulo) significa kit padrão, tanto na conta quanto no material.
- **Por quê**: o kit padrão é a marca da empresa no sistema inteiro (decisão do
  dono do produto). Mover esses campos para uma tabela nova obrigaria a mudar
  Configurações → Marca, `buildBrandedContext`, a extração por logo e o Linnker,
  com migração de dados de todas as empresas.
- **Alternativas descartadas**: linha "padrão" em `BrandKit` espelhando
  `Organization.brand*` (duas fontes para o mesmo dado, sincronização para
  sempre); mover tudo para `BrandKit` (raio de impacto fora do Planner).
- **Consequência**: `getBrandKit(organizationId, brandKitId?)` tem dois caminhos
  de leitura que devolvem o **mesmo formato**; os consumidores não sabem de qual
  veio. Nenhum dado existente é reescrito.

### D-2 — O vínculo mora na conta (`SocialChannel.brandKitId`)

- **Escolha**: coluna nula em `SocialChannel`, ponteiro solto com
  `onDelete: SetNull` — apagar o kit devolve a conta ao padrão sozinho (RF-10).
- **Alternativas descartadas**: vínculo no post (escolha por post, descartada
  pelo dono do produto); tabela de ligação N:N (uma conta tem um kit só).
- **Consequência**: o módulo `social` ganha um campo que ele não interpreta.
  O resolvedor fica no Planner (`resolveBrandKitForPost`), não no módulo.

### D-3 — O post resolve o kit na hora, não guarda cópia

- **Escolha**: `resolveBrandKitForPost(post)` lê `targetIgAccountId` → conta nos
  Satélites → `brandKitId`. Nada é gravado no post.
- **Por quê**: trocar a conta do post ou o kit da conta precisa valer
  imediatamente (CB-1, CB-2) sem job de sincronização.
- **Alternativas descartadas**: `brandKitId` no post (fica velho quando a conta
  muda de kit).
- **Consequência**: não há registro de qual kit gerou um texto antigo. Aceito:
  o texto gerado já está no post.

### D-4 — Materiais passam a ter kit (`BrandKitAsset.brandKitId`)

- **Escolha**: coluna nula; nulo é material do kit padrão. `onDelete: Cascade`
  a partir do kit — apagar o kit apaga os materiais dele.
- **Consequência**: o arquivo no R2 dos materiais apagados fica órfão, como já
  acontece hoje ao remover um material. Limpeza de arquivos é dívida existente,
  fora desta spec.

### D-5 — Cópia do padrão não leva arquivos

- **Escolha**: "Criar como cópia" copia identidade e listas de texto; logos e
  materiais não. Logos são referências a arquivo e, copiados, apontariam para o
  mesmo arquivo do kit padrão — trocar num alteraria o outro quando o arquivo
  fosse substituído.
- **Consequência**: kit copiado nasce com o medidor incompleto nos itens de
  logo e materiais.

## 7. Impacto

- [x] Schema / migration — tabela `brand_kits`; `brand_kit_assets.brand_kit_id` e `social_channels.brand_kit_id` nulos. Só aditiva
- [x] Procedures oRPC — `nasaPlanner.brandKit.*` ganham `brandKitId` opcional; novas `list`, `create`, `rename`, `delete`; nova `socialAccounts.setBrandKit`; `generateScriptsWithAstro` passa a receber a conta do post
- [ ] Realtime
- [ ] Automações (Inngest)
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes — não: sem os parâmetros novos tudo responde com o kit padrão (CB-12)
- [x] Documentação obrigatória — `docs/nasa-planner-overview.md`; `docs/comments-overview.md` (campo novo em `SocialChannel`); `pnpm guides:check` (regra 21); ritual pós-migration (regra 11)

Arquivos principais:

- `prisma/schema.prisma`, migration nova
- `src/features/nasa-planner/server/brand-kit/brand-kit.ts`, `generate-scripts.ts`, novo `resolve-brand-kit.ts`
- `src/app/router/nasa-planner/v2/brand-kit.ts`, `src/app/router/social-accounts/index.ts`
- `src/features/nasa-planner/components/brand-kit/`, `components/v2/composer-astro-panel.tsx`, `lib/brand-checklist.ts`, `server/cross-org.ts` (`assertPostAccess`)
- `src/features/social-accounts/components/social-account-card.tsx`
- `src/features/astro/server/tools/planner/index.ts`, `src/features/external-ai/server/mcp/planner-mcp-tools.ts`

## 8. Plano de testes

Sem runner no projeto (CLAUDE.md, regra 20): os casos de servidor viram
`scripts/brand-kits-qa-check.ts` contra o Postgres local.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-9, CA-10 | script | Ler o kit padrão antes e depois de criar e editar um adicional; conferir `Organization.brand*` |
| CA-2, CA-3, CA-4, CB-4, CB-5, CB-6 | script | `resolveBrandKitForPost` e `buildBrandKitPrompt` para posts de contas com e sem vínculo |
| CA-5 | script | Checklist da marca com palavra proibida só no kit adicional |
| CA-6, CA-7, CA-8, CA-12, CA-13, CB-7 | script | Apagar, limite, cópia, nome repetido, kit de outra empresa |
| CA-11 | manual | Usuário com papel sem permissão de criar |
| RF-5, RF-6, RF-7, RF-12, CB-10 | manual | Aba Kit da Marca e cartão da conta nos Satélites, com a empresa de `scripts/social-accounts-qa-seed.ts` |
| CA-2 ponta a ponta | manual | "Gerar com o Astro" real, com chave de IA configurada |
| CA-14 | automatizado | `pnpm guides:check` |

## 9. Riscos e rollback

- **Astro escrevendo com a marca errada.** Se algum ponto de leitura continuar
  chamando `getBrandKit(organizationId)` sem o kit do post, o conteúdo do
  cliente B sai com a voz do padrão sem erro nenhum. Mitigação: os consumidores
  do Planner passam a usar só `resolveBrandKitForPost`; o script cobre cada um.
- **Apagar kit é irreversível** para os materiais dele. Mitigação: confirmação
  com a contagem de contas e de materiais.
- **Rollback**: a migration é aditiva. Revertendo o código, as colunas novas
  ficam ignoradas e tudo volta a ler o kit padrão; kits adicionais e seus
  materiais ficam no banco, invisíveis. O `findMany` de materiais do código
  antigo não filtra por kit, então **os materiais de kits adicionais apareceriam
  misturados no kit padrão** — ao reverter, apagar antes os materiais com
  `brand_kit_id` preenchido ou reverter também a coluna.
- **Mesma limitação para outras partes do Planner**: roteiro, temas, pilares e
  metas seguem por empresa (não-objetivo). Duas marcas na mesma empresa ainda
  dividem esses itens.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-05 | João Gabriel | Criada. Decisões do dono do produto: vínculo pela conta do Instagram; kit padrão continua sendo a marca de Configurações → Marca; só o kit nesta etapa; quem cria no Planner cria e edita kits, owner e admin vinculam |
| 2026-10-05 | João Gabriel | Aprovada e **implementada**. Marcados os critérios provados por `scripts/brand-kits-qa-check.ts` e por `pnpm guides:check` (CA-14). Abertos: CA-7 (kit padrão não tem id, então a procedure de apagar não tem como recebê-lo — conferido por construção, sem teste) e CA-11 (papel sem permissão de criar, conferência manual). Desvios do texto: (1) o vínculo conta–kit ficou em `nasaPlanner.brandKit.setAccountKit`, e não em `socialAccounts.setBrandKit`, para a regra não entrar no módulo `social`; (2) no cartão da conta em Satélites › Instagram o kit é **mostrado** com um link "trocar no Planner", em vez de um seletor no próprio cartão — a troca fica só na aba Kit da Marca (RF-7 parcial); (3) `get_video_templates` do MCP segue usando o kit padrão |
| 2026-10-05 | João Gabriel | Aba Kit da Marca redesenhada, sem mudança de regra: kits em lista lateral (RF-5), contas do Instagram dentro do cabeçalho do kit, com vincular e desvincular a partir do kit (RF-6, RF-7), e o medidor dividido em três etapas (RF-4) |
