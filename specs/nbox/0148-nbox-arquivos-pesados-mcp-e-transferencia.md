---
id: 0148
titulo: Nbox com arquivos pesados, acesso pelo MCP e transferência com prazo
dominio: nbox
status: aprovada
autor: João Gabriel (com Claude)
criada: 2026-11-23
atualizada: 2026-11-23
branch: claude/nbox-module-expansion-9887a1
pr:
peso: completa
---

# 0148 — Nbox com arquivos pesados, acesso pelo MCP e transferência com prazo

## 1. Contexto

As equipes dos clientes, principalmente as de marketing, lidam com muitos arquivos
(vídeo bruto, artes, comprovantes) e hoje resolvem isso fora do ÓRBITA: Drive,
WeTransfer, WhatsApp. O Nbox existe, mas não dá conta:

| Problema hoje | Onde | Consequência |
| --- | --- | --- |
| Limite de **20 MB** por arquivo | `src/app/api/s3/upload/route.ts` | Vídeo de campanha não entra |
| Cota do plano (500 MB / 2 GB / 10 GB) **só exibida, não aplicada** | `src/app/router/nbox/get-storage.ts` | Não há como cobrar excedente depois |
| O tamanho gravado é o que o **navegador informa** | `create-item.ts` (`size` vem do input) | A conta do espaço usado pode ser falsificada |
| `createItem` aceita qualquer chave do bucket em `url` | `create-item.ts` | Um item pode apontar para arquivo de outra empresa |
| Apagar item **não apaga o arquivo no R2** | `delete-item.ts` | Arquivo órfão pago para sempre |
| Download público passa os bytes **pelo nosso servidor** | `api/nbox/public/[token]/route.ts` | Um arquivo de 5 GB ocupa o container durante todo o download |
| Link público depende da Spacehome estar pública | mesma rota | Não serve para mandar arquivo a um cliente |
| Rota de upload sem login | `api/s3/upload` | Qualquer um gera link de envio para o bucket (ver D-2) |

Pedido do produto: arquivos pesados, uso por agentes de IA via MCP, guarda de
documentos importantes, transferência rápida com prazo de exclusão (padrão 2 dias),
o Nbox como banco do Planner e guarda de logos e imagens. Esta spec cobre a base
(espaço, envio pesado, MCP e transferência). Planner, Kit da Marca e IA têm spec
própria depois (ver Não-objetivos).

## 2. Objetivo

A empresa guarda até **150 GB** no Nbox, envia arquivos de até **5 GB**, cria um
link de transferência que se apaga sozinho e deixa um agente de IA listar, ler e
enviar arquivos do Nbox pelo MCP do ÓRBITA.

### Não-objetivos

- **Cobrança do excedente.** Esta spec só deixa o limite num lugar só e aplicado
  (D-1), pronto para a cobrança se ligar depois.
- **Planner usando o Nbox** e **atalho do Kit da Marca no Nbox**: spec própria (fase 3).
  Logos já moram no Kit da Marca (`Organization.brandLogoVariants`, `BrandKitAsset`)
  e não serão copiados para o Nbox.
- **IA no Nbox** (ler comprovante, organizar sozinho, busca por conteúdo): spec
  própria (fase 4), depois de definir o que o cliente espera.
- **Ligar comprovante a lead/cliente** (`leadId`): fica para a fase 4, junto da leitura de comprovantes.
- Senha no link de transferência, aviso por e-mail ao destinatário e contador de downloads.
- Proteger `/api/s3/upload` (rota usada por 25 telas, inclusive páginas públicas): tarefa separada (D-2).
- Pastas e itens antigos: nada muda neles.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | O limite de espaço é **150 GB por empresa em todos os planos**, definido num único lugar (`NBOX_STORAGE_LIMIT_BYTES_BY_PLAN` em `src/features/nbox/lib/storage-limits.ts`). |
| RF-2 | Envio novo do Nbox é feito por procedure própria, com login e escopo de `organizationId`. A chave do arquivo é gerada no servidor com o prefixo `nbox/<organizationId>/`. |
| RF-3 | Arquivo de até **5 GB**. Acima de 100 MB o envio é em partes (multipart), reaproveitando o padrão de `creator-start-video-upload.ts`. |
| RF-4 | Antes de liberar o envio, o servidor recusa se `usado + tamanho > limite`. Ao concluir, o servidor lê o tamanho real no R2 (`HeadObject`) e grava esse valor, não o informado pelo navegador. |
| RF-5 | A tela mostra aviso com 90% do espaço usado e bloqueia o envio quando passar do limite, com o texto "Espaço do Nbox cheio". |
| RF-6 | Apagar um item com chave `nbox/<organizationId>/...` apaga também o arquivo no R2 (`deleteStoredObject`), depois de o registro ser apagado. |
| RF-7 | **Transferência**: o usuário escolhe arquivos (novos ou já no Nbox), um prazo de 1, 2 (padrão) ou 7 dias e recebe um link `/t/<token>`. |
| RF-8 | A página `/t/<token>` funciona sem login e sem depender da Spacehome: mostra nome da empresa, arquivos, tamanhos e "expira em". Cada download devolve um redirecionamento para link assinado do R2 de 15 minutos. |
| RF-9 | Depois do prazo, a página responde "Esta transferência expirou" e nenhum link de download é gerado. O arquivo e o registro são apagados em até 24 h. |
| RF-10 | Arquivo da transferência conta no espaço da empresa até ser apagado. |
| RF-11 | Transferências ficam numa seção própria "Transferências" no Nbox (fora da árvore de pastas), com copiar link, prorrogar e encerrar já. Prorrogar leva o prazo ao teto: **nenhuma transferência vale mais de 7 dias contados da criação** (D-8). |
| RF-12 | Arquivo de pasta restrita não pode entrar em transferência. |
| RF-13 | **MCP**: novo app "Nbox" em `MCP_APPS` com `nbox_list_folders`, `nbox_list_items` (busca, pasta, até 50 por página), `nbox_get_download_url` (link de 15 min), `nbox_request_upload_url` + `nbox_complete_upload` e `nbox_create_transfer`. |
| RF-14 | No MCP valem as mesmas regras da tela: escopo de organização, pasta restrita só para quem `canViewRestrictedNBox`, cota do RF-4 e limite do RF-3. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhum byte de arquivo passa pelo container do app no envio nem no download (só links assinados). |
| RNF-2 | Nenhuma tabela nova e nenhuma função nova no Inngest (D-3, D-4). |
| RNF-3 | Cálculo do espaço usado em uma query agregada indexada por `organizationId`, sem carregar itens. |
| RNF-4 | Stars: arquivo guardado continua cobrando `nbox_upload`; transferência não cobra Star (nem arquivo enviado nela, nem cópia). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado uma empresa em qualquer plano, quando abre o Nbox, então vê "de 150 GB".
- [ ] **CA-2** — Dado 149,5 GB usados, quando pede para enviar 1 GB, então o servidor recusa com "Espaço do Nbox cheio" e nenhum link de envio é gerado.
- [ ] **CA-3** — Dado um arquivo de 3 GB, quando envia, então o envio vai em partes, o item aparece e `size` é o tamanho lido no R2.
- [ ] **CA-4** — Dado um arquivo de 6 GB, quando tenta enviar, então é recusado antes de qualquer byte subir.
- [ ] **CA-5** — Dado o navegador informando 1 KB para um arquivo de 2 GB, quando conclui, então o item é gravado com 2 GB.
- [ ] **CA-6** — Dado um usuário da empresa A, quando chama a conclusão com uma chave `nbox/<empresa B>/...`, então recebe erro e nada é gravado.
- [ ] **CA-7** — Dado um item enviado pelo fluxo novo, quando é apagado, então o objeto some do R2.
- [ ] **CA-8** — Dado um item antigo (chave sem prefixo `nbox/`), quando é apagado, então só o registro sai e o objeto fica no R2.
- [ ] **CA-9** — Dado uma transferência de 2 dias, quando alguém sem login abre `/t/<token>`, então vê os arquivos e baixa cada um.
- [ ] **CA-10** — Dado uma transferência vencida, quando abre o link ou tenta baixar, então vê "Esta transferência expirou" e não recebe link do R2.
- [ ] **CA-11** — Dado uma transferência vencida há mais de 24 h, então não há registro nem objeto no R2 e o espaço usado já desconta o tamanho dela.
- [ ] **CA-12** — Dado um arquivo de pasta restrita, quando tenta incluir numa transferência (tela ou MCP), então é recusado.
- [ ] **CA-13** — Dado um agente conectado pelo MCP de um usuário sem acesso à pasta restrita, quando chama `nbox_list_items`, então os itens restritos não aparecem.
- [ ] **CA-14** — Dado um agente pelo MCP, quando faz `nbox_request_upload_url` → PUT → `nbox_complete_upload`, então o item aparece na pasta pedida com o tamanho real.
- [ ] **CA-15** — Dado uma transferência ativa, quando o dono clica "Encerrar já", então o link passa a responder expirado na hora.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Dois envios simultâneos que juntos passam do limite | Os dois passam na checagem inicial; a conclusão confere de novo e recusa o segundo, apagando o objeto dele no R2. Sobra aceitável: no máximo um arquivo. |
| CB-2 | Envio começou e o usuário fechou a aba | Multipart incompleto: a limpeza diária lista os envios em partes pendentes do prefixo `nbox/` no R2 e aborta os de mais de 1 dia (sem tabela de controle). Envio simples sem conclusão: objeto órfão; ver Riscos. |
| CB-3 | Conclusão chamada duas vezes (clique duplo, retry do MCP) | Idempotente: a mesma chave não cria segundo item (procura por `organizationId + url` antes de criar). |
| CB-4 | Empresa que já tem mais que 150 GB | Não acontece hoje (maior limite era 10 GB). Se acontecer, só bloqueia envio novo; nada é apagado. |
| CB-5 | Item antigo sem `size` (null) | Conta como 0, como hoje. |
| CB-6 | Item da transferência que também está numa pasta normal | Não acontece: incluir um arquivo existente numa transferência **cria um item novo apontando para uma cópia** (`CopyObject` no R2, sem passar pelo app). Assim apagar a transferência não apaga o original. |
| CB-7 | Transferência prorrogada depois de vencer, mas antes da limpeza | Não permitido: depois de vencer, só dá para criar outra. Já no teto de 7 dias: "Prorrogar" some e o servidor recusa. |
| CB-8 | Token de transferência inválido ou de pasta comum | 404 "Transferência não encontrada". |
| CB-9 | Item da transferência ligado a `NasaCampaignBrandAsset` | A relação é `SetNull`; a limpeza apaga sem quebrar. Arquivo de transferência não deve ser escolhido como material de campanha (filtro na listagem). |
| CB-10 | Pasta comum apagada | Comportamento atual mantido (itens vão para a raiz por `SetNull`). |
| CB-11 | Download de arquivo antigo pela rota pública atual | Rota atual passa a redirecionar para link assinado em vez de repassar os bytes (RNF-1). O comportamento para quem baixa é o mesmo. |
| CB-13 | Transferência criada e o envio dos arquivos novos falha | A transferência é criada antes do envio. Se tudo falhar, o link existe e a página diz "Os arquivos ainda estão sendo enviados"; o dono encerra na seção Transferências. |
| CB-14 | Item salvo pelo caminho antigo (`items.create`, usado pelo chat ao "salvar no Nbox") | O tamanho passa a ser lido no R2 e a cota é conferida. Chave `nbox/<outra empresa>/` é recusada. Chave antiga sem prefixo não dá para provar de quem é: risco residual, ver Riscos. |
| CB-12 | Bucket sem CORS para PUT do navegador | Pendência já conhecida (`CLOUDFLARE_R2_CORS_PENDING.md`). Precisa estar resolvida em produção antes do deploy; também vale para as partes do multipart (`ETag` exposto). |

## 6. Decisões de design

### D-1 — Limite de 150 GB num lugar só, igual para todos os planos

- **Escolha**: um mapa por plano em `src/features/nbox/lib/storage-limits.ts`, todos com 150 GB, lido pela tela e pela checagem de envio.
- **Alternativas descartadas**: coluna no `Plan` agora (migration para um valor que é igual em todos os planos); limite só por arquivo (não permite cobrar excedente).
- **Consequência**: quando vier a cobrança, só esse mapa (ou a fonte que o substituir) muda. Custo estimado: R2 cobra ~US$ 0,015/GB/mês, ou seja, ~US$ 2,25/mês por empresa cheia. O plano grátis também ganha 150 GB, por decisão do produto (2026-11-23): risco de uso como depósito sem pagar, reavaliado quando vier a cobrança.

### D-2 — Envio próprio do Nbox em vez de proteger `/api/s3/upload`

- **Escolha**: procedures novas no router do Nbox (`start-upload`, `complete-upload`) com login, cota e prefixo por empresa.
- **Alternativas descartadas**: colocar login em `/api/s3/upload` (25 telas usam, inclusive chat público do WhatsApp e formulários públicos; quebraria envio de visitante).
- **Consequência**: a rota antiga continua aberta. Fica registrada como tarefa separada de segurança, fora desta spec.

### D-3 — Transferência é uma pasta com prazo, sem tabela nova

- **Escolha**: colunas novas em `NBoxFolder`: `expiresAt DateTime?` e `shareToken String? @unique`. Transferência = pasta com `expiresAt` preenchido, sem `parentId`. A árvore normal filtra `expiresAt: null`.
- **Alternativas descartadas**: model `NBoxTransfer` + tabela de ligação (duas tabelas para o que pasta já é: um grupo de itens); `expiresAt` só no item (não agrupa vários arquivos num link, como no WeTransfer).
- **Consequência**: índice `@@index([expiresAt])` para a limpeza. `toggleItemPublic` e a rota pública atual continuam iguais para itens comuns.

### D-4 — Limpeza das transferências sem função nova no Inngest

- **Escolha**: acesso bloqueado na hora pela checagem de `expiresAt` (RF-9); exclusão física em lote por um passo novo dentro de um cron diário já existente (`nasa-route-video-uploads-cleanup`, 04:00), que passa a se chamar `storage-daily-cleanup`. 1 execução por dia, 1 step a mais, lotes de 200.
- **Alternativas descartadas**: cron novo (S11: já passamos do limite do plano); `step.sleepUntil` por transferência (uma execução por transferência criada); regra de expiração do R2 por prefixo (só aceita prazos fixos e deixa o registro no banco).
- **Consequência**: arquivo vencido pode ficar até 24 h no R2 (sem acesso). Renomear a função exige "Resync" no Inngest no deploy.

### D-5 — MCP com o mesmo código da tela

- **Escolha**: as ferramentas `nbox_*` chamam as mesmas funções de servidor das procedures (`src/features/nbox/server/`), com o usuário do token como ator.
- **Alternativas descartadas**: lógica separada para o MCP (regras de cota e pasta restrita duplicadas e divergindo).
- **Consequência**: as procedures atuais do Nbox que forem tocadas passam a delegar para `features/nbox/server/`.

### D-8 — Arquivo temporário em prefixo próprio, com regra de expiração no R2

- **Escolha**: arquivos de transferência (enviados nela ou copiados para ela) ficam em `nbox-transfers/<organizationId>/`; os guardados, em `nbox/<organizationId>/`. No bucket, uma regra de ciclo de vida apaga objetos de `nbox-transfers/` com mais de **8 dias**. A transferência vale no máximo 7 dias desde a criação, então a regra nunca apaga link válido.
- **Por quê**: a limpeza diária (D-4) continua sendo o caminho principal; a regra é a rede de segurança se o cron falhar ou atrasar. O arquivo temporário nunca fica guardado para sempre, como nos apps de transferência.
- **Alternativas descartadas**: regra no prefixo `nbox/` (apagaria os arquivos guardados); prorrogar sem teto (a regra apagaria arquivo de link ainda válido).
- **Consequência**: chave temporária não pode virar item comum (`items.create` recusa) e o envio confere se o prefixo da chave bate com o tipo da pasta de destino. O original guardado no Nbox nunca é apagado pela transferência.

### D-7 — `NBoxItem.size` passa a ser BigInt

- **Escolha**: `BigInt` no banco; servidor converte para número nas respostas (`toNboxItemDto`).
- **Alternativas descartadas**: manter `Int` e limitar o arquivo a 2 GB (o `Int` do Postgres vai até ~2,1 GB; a spec aprovada pede 5 GB).
- **Consequência**: quem lê `size` direto do Prisma recebe `bigint`. A checagem de tipos apontou todos os lugares.

### D-6 — Download sempre por link assinado

- **Escolha**: rotas de download respondem 302 para link assinado de 15 minutos (5 min na rota pública atual, como o cache dela).
- **Alternativas descartadas**: repassar os bytes pelo app (ocupa o container com arquivo de GB; não escala com 2 instâncias).

## 7. Impacto

- [x] Schema / migration: `NBoxFolder.expiresAt`, `NBoxFolder.shareToken`, índice em `expiresAt`, e `NBoxItem.size` de `Int` para `BigInt` (D-7). Reversível enquanto nenhum arquivo passar de 2 GB.
- [x] Procedures oRPC: `nbox.startUpload`, `nbox.completeUpload`, `nbox.createTransfer`, `nbox.listTransfers`, `nbox.updateTransfer` (prorrogar/encerrar). `createItem` continua aceitando chaves antigas (o chat usa), mas lê o tamanho no R2, confere a cota e recusa chave `nbox/` de outra empresa (CB-14). As respostas de itens devolvem `size` como número.
- [ ] Realtime
- [x] Automações (Inngest): passo novo no cron diário existente, renomeado (D-4). Sem função nova.
- [ ] Env vars novas
- [ ] Breaking change: não. O envio antigo continua funcionando para itens antigos até a tela trocar.
- [x] Documentação: guia do Astro (`astro-guides/lib/guides/nbox.ts`) ganha âncoras de "Transferências" (regra 21); instruções do app Nbox no MCP.
- [x] Configuração do bucket R2 (fora do código): CORS com `PUT` liberado e `ETag` em `ExposeHeaders` (sem isso o envio em partes falha com "CORS sem ETag"); e a regra de ciclo de vida "apagar objetos com prefixo `nbox-transfers/` depois de 8 dias" (D-8).

## 8. Plano de testes

Não há runner de testes instalado (CLAUDE.md, regra 20). Até haver, cada CA é verificado manualmente no ambiente local com R2 de desenvolvimento, e o resultado é registrado no PR.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-4 | manual | Ajustar o espaço usado no banco local e tentar o envio |
| CA-3, CA-5, CA-14 | manual | Enviar arquivo grande pela tela e pelo MCP; conferir `size` contra o R2 |
| CA-6, CA-12, CA-13 | manual | Chamar procedure/ferramenta com ids de outra empresa ou pasta restrita |
| CA-7, CA-8 | manual | Apagar e conferir no R2 |
| CA-9, CA-10, CA-11, CA-15 | manual | Criar transferência, abrir em aba anônima, forçar `expiresAt` no passado e disparar o cron no Inngest dev |

## 9. Riscos e rollback

- **Objeto órfão de envio simples sem conclusão** (CB-2): custo pequeno, sem acesso. Se crescer, a limpeza diária pode listar o prefixo `nbox/` e apagar o que não tem registro há mais de 1 dia (fica como melhoria).
- **Plano grátis com 150 GB**: possível abuso de espaço. Mitigação: o limite é uma linha (D-1).
- **CORS do bucket**: sem ele, o envio pelo navegador falha em produção (CB-12). Conferir antes do deploy.
- **Chave antiga sem prefixo** (CB-14): o caminho antigo ainda aceita chave que não dá para provar de quem é. Fecha quando o chat passar a usar o envio novo (tarefa separada).
- **Limpeza em lote de 200 transferências por dia**: acima disso, o resto fica para o dia seguinte (sem acesso, só ocupando espaço).
- **Rollback**: a migration só adiciona colunas que aceitam nulo e alarga `size`. Voltar o código não quebra dados; transferências criadas viram pastas ocultas e a limpeza diária, se revertida, para de apagá-las.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-23 | João Gabriel (com Claude) | Criada. Limite de 150 GB em todos os planos decidido pelo produto. |
| 2026-11-24 | João Gabriel (com Claude) | RNF-4: transferência não cobra Star. |
| 2026-11-23 | João Gabriel (com Claude) | D-8: arquivos de transferência em `nbox-transfers/` com regra de 8 dias no R2; transferência vale no máximo 7 dias desde a criação. |
| 2026-11-23 | João Gabriel (com Claude) | Aprovada. Na implementação: `size` virou BigInt (D-7); envio em partes abandonado é abortado pela limpeza diária, não por regra do bucket (CB-2); caminho antigo `items.create` mantido para o chat, com tamanho lido no R2 (CB-14); CB-13. |
