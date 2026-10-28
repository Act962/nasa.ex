---
id: 0118
titulo: Loja Órbita — comprar itens com STARS e posicioná-los na Órbita Station 3D
dominio: orbita-station
status: rascunho
autor: João Gabriel (com Claude)
criada: 2026-10-27
atualizada: 2026-10-27
branch: claude/focused-hamilton-2dc35f
pr: 482
peso: completa
---

# 0118 — Loja Órbita: itens comprados com STARS e posicionados na estação 3D

> **Depende de:**
> - [0117](0117-orbita-station-3d-etapa-1.md): a estação como código do app.
> - [0119](0119-orbita-station-etapa-2-estacao-da-empresa.md), a **etapa 2**: a estação da empresa no banco (`OrbitaStation`), a sala de tempo real e a permissão `orbita-station`.
> - A **etapa 3**: o editor de decoração, que entra junto com esta loja (os dois põem objetos na estação e dividem a regra de posição).
>
> Esta spec não pode ser implementada antes da 0117 e da 0119.

## 1. Contexto

O protótipo do Órbita Station 3D (artifact publicado, versões 29 a 33) validou com o time o fluxo de **comprar um objeto decorativo e colocá-lo na estação**:

- **Comprar:** Loja Órbita → Comprar, pagando com STARS.
- **Abrir o inventário:** botão direito no piso → "Meus itens da loja" → Inventário → Adicionar.
- **Posicionar:** a prévia segue o cursor sobre o piso, com contorno azul pulsante → botão direito → "Soltar aqui".
- **Mover:** botão direito no objeto → "Arrastar item". Esc cancela.

O Órbita Station 3D é um **produto novo**, sem relação com a Space Station 2D (`src/features/space-station/`). Esta loja não usa o catálogo, o mapa nem as tabelas da Space Station.

O protótipo grava tudo no navegador (`localStorage`). O saldo é de exemplo e nada é validado no servidor. Para levar isso ao produto, há três lacunas:

1. **Não existe inventário nem compra de objeto 3D.** Nada no app liga um móvel da estação a uma compra.
2. **Item pago precisa ser dado da empresa, protegido no servidor.**
   - Se a posição dos itens ficasse junto com a decoração da estação, num JSON regravado inteiro a cada salvamento, um item pago poderia ser apagado ou duplicado.
   - Um salvamento também apagaria o que outra pessoa acabou de posicionar.
3. **O débito de STARS de hoje tem disputa.**
   - `debitStars` (`src/features/stars/lib/star-service.ts`) e `executeTicketPurchaseInTx` (`src/app/router/world-events/helpers/purchase-ticket-helpers.ts`) **leem o saldo e depois gravam o novo valor**, dentro de uma transação.
   - No PostgreSQL, com o isolamento padrão (`READ COMMITTED`), duas compras simultâneas podem passar as duas pela checagem de saldo.

## 2. Objetivo

A empresa compra objetos da Loja Órbita com STARS reais. Cada unidade comprada fica guardada no banco como dela. Quem tem permissão posiciona, move e retira essas unidades na estação 3D, com tudo validado no servidor e sem cobrança duplicada.

### Não-objetivos

- **Space Station 2D.** Nada aqui muda, lê ou grava algo do Space Station.
- **Space Points (SP).** A compra é só em STARS. SP não é aceito nem creditado.
- **Venda, troca ou devolução de itens.** Não há reembolso por item, e tirar da estação não devolve STARS.
- **Itens funcionais** (guichê, mesa que muda capacidade, painel da fila). Só itens decorativos.
- **Editor de decoração gratuito** (cores do piso, luz, itens grátis). Entra na etapa 3, junto com esta loja, mas tem decisões próprias.
- **Orçamento por pessoa** (`MemberStarBudget.monthlyBudget`). Hoje ele não bloqueia nenhum débito. Esta spec só registra o `userId` na transação, como os débitos atuais.
- **Corrigir a disputa de saldo em `debitStars` e no ingresso de evento.** Fica registrada como achado para uma tarefa separada (§9). Esta spec só exige que o débito **novo** seja atômico.
- **Escala livre do objeto.** O item tem um tamanho só. Muda só a posição e o giro.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | O catálogo da loja é uma lista no código (`SHOP_CATALOG`, em `src/features/orbita-station/layout/`). Cada item tem chave estável, nome, categoria, preço em STARS, o modelo `.glb` e o tamanho que ocupa no piso (D-3). |
| RF-2 | Comprar debita STARS da empresa e cria **uma unidade de inventário por compra**, na mesma transação, com uma `StarTransaction` do tipo novo `STATION_ITEM_PURCHASE`. |
| RF-3 | A compra é idempotente: o cliente manda uma `purchaseKey` (UUID gerado ao abrir a confirmação). Repetir a mesma chave devolve a unidade já criada, sem novo débito. |
| RF-4 | Com saldo insuficiente, a compra é recusada com `INSUFFICIENT_STARS` e nada é gravado. |
| RF-5 | O inventário lista as unidades da empresa agrupadas por item: quantas estão disponíveis, quantas estão na estação e, quando não dá para adicionar, o motivo. |
| RF-6 | Posicionar grava a posição na própria unidade: estação, `x`, `z`, giro em quartos de volta, quem posicionou e quando. |
| RF-7 | Mover troca a posição da mesma unidade, **sem cobrança**. A posição antiga vale até a confirmação. |
| RF-8 | Retirar da estação limpa a posição e devolve a unidade ao inventário, sem estorno. |
| RF-9 | O servidor valida a posição com a **mesma função pura** de montagem e colisão da 0117. O item precisa estar sobre o piso de uma sala ou corredor. Ele não pode sobrepor parede, móvel fixo ou outro item comprado, nem bloquear porta, passagem do corredor ou ponto de chegada. |
| RF-10 | Na estação, botão direito (ou toque longo) abre um menu de contexto conforme o alvo. Piso → "Meus itens da loja". Item posicionado → "Arrastar item". Item em posicionamento → "Soltar aqui", "Girar" e "Cancelar". |
| RF-11 | Durante o posicionamento, o item segue o cursor sobre o piso, com contorno azul pulsante, e mostra o motivo quando o lugar é inválido. Esc cancela sem gravar. |
| RF-12 | Posicionar, mover ou retirar avisa quem está na estação (pela sala do LiveKit da estação, spec 0119, D-3), e todos veem a mudança sem recarregar. |
| RF-13 | Os itens comprados aparecem para todos que entram na estação da empresa. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | O débito é atômico: a linha da empresa fica travada (`SELECT … FOR UPDATE`) dentro da transação da compra, ou a compra usa um decremento condicional. Duas compras simultâneas nunca deixam o saldo negativo. |
| RNF-2 | A transação da compra contém só escritas de banco (CLAUDE.md, regra 18). O aviso em tempo real e o alerta de saldo rodam depois do commit e não quebram a compra se falharem. |
| RNF-3 | Toda procedure filtra pelo `organizationId` da sessão. Um id de outra empresa responde `NOT_FOUND`, não `FORBIDDEN`, para não confirmar que ele existe. |
| RNF-4 | A listagem do inventário é limitada (`take`) e usa o índice `(organizationId, itemKey)`. |
| RNF-5 | A regra de posição (RF-9) é uma função só, em `src/features/orbita-station/layout/`, sem Three.js e sem DOM. Ela é usada pela prévia no navegador e pela procedure. Duas versões da regra iriam divergir. |
| RNF-6 | Não há função nem cron nova no Inngest (CLAUDE.md, S11): tudo é síncrono e rápido. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um item à venda por 25 ★ e a empresa com 100 ★, quando um Master compra, então o saldo fica em 75 ★, existe uma `StarTransaction` `STATION_ITEM_PURCHASE` de −25 com o `userId` dele, e o inventário ganha uma unidade disponível.
- [ ] **CA-2** — Dada a mesma `purchaseKey` enviada duas vezes (clique duplo ou nova tentativa de rede), então há **um** débito e **uma** unidade, e a segunda resposta devolve a mesma unidade.
- [ ] **CA-3** — Dadas duas compras simultâneas com chaves diferentes, a empresa com 30 ★ e o item a 25 ★, então uma compra passa, a outra recebe `INSUFFICIENT_STARS`, e o saldo final é 5 ★.
- [ ] **CA-4** — Dado um membro sem permissão de compra, quando ele chama a compra direto pela API, então recebe `FORBIDDEN` e nada é gravado.
- [ ] **CA-5** — Dada uma unidade disponível, quando ela é posicionada num lugar válido, então a unidade passa a ter estação e posição, e outro usuário conectado vê o item sem recarregar.
- [ ] **CA-6** — Dada uma posição fora do piso, sobre parede, móvel fixo ou outro item, ou na frente de uma porta, quando a procedure é chamada, então ela recusa com o motivo (`OUT_OF_BOUNDS`, `BLOCKED_AREA`, `OVERLAPS_ITEM` ou `BLOCKS_PASSAGE`) e a unidade não muda.
- [ ] **CA-7** — Dada uma unidade posicionada, quando ela é movida para outro lugar válido, então a posição muda, o saldo não muda e não surge uma segunda unidade.
- [ ] **CA-8** — Dado um item em movimentação, quando o usuário aperta Esc, então nenhuma chamada de gravação é feita e o item volta à posição salva.
- [ ] **CA-9** — Dada uma unidade de outra empresa, quando alguém tenta posicionar, mover ou retirar com o id dela, então recebe `NOT_FOUND`.
- [ ] **CA-10** — Dado um item posicionado, quando a página é recarregada, então ele aparece no mesmo lugar.
- [ ] **CA-11** — Dado o menu de contexto aberto, quando o usuário clica fora, aperta Esc ou escolhe uma ação, então o menu fecha, e o clique de fora não faz o personagem andar.
- [ ] **CA-12** — Dado um aparelho de toque, quando o usuário segura o dedo no piso por ~0,5 s, então abre o mesmo menu do botão direito.
- [ ] **CA-13** — Dada uma unidade já posicionada, quando duas pessoas a movem ao mesmo tempo, então só a primeira grava, e a segunda recebe `CONFLICT` e vê a posição nova.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Clique duplo em "Comprar" ou nova tentativa após timeout | A mesma `purchaseKey` devolve a unidade existente, sem novo débito (RF-3). |
| CB-2 | Duas abas compram ao mesmo tempo com saldo para só uma | A trava ou o decremento condicional deixa uma passar, e a outra recebe `INSUFFICIENT_STARS` (RNF-1). |
| CB-3 | Empresa suspensa por falta de STARS (`starsSuspendedAt`) | `requireStarsMiddleware` barra a compra com `STARS_SUSPENDED`. Posicionar, mover e retirar continuam liberados, porque não custam nada. |
| CB-4 | O saldo pago é menor que o preço, mas pago + bônus cobre | A compra aceita bônus, como o `APP_SETUP` (D-4). A descrição registra a divisão, igual ao `debitStars`. |
| CB-5 | O preço do item muda depois da compra | A unidade guarda `pricePaidStars`. O preço novo não afeta quem já comprou. |
| CB-6 | O item sai da loja (marcado `retired` no catálogo) | Ele some da loja. As unidades já compradas continuam no inventário e na estação, porque o modelo `.glb` continua no repositório. |
| CB-7 | Alguém apaga do catálogo a entrada ou o `.glb` de um item com unidades vendidas | Proibido. Item vendido só pode ser marcado `retired` (D-3). Um teste confere que toda `itemKey` do catálogo tem modelo. Unidade com chave desconhecida aparece como caixa com o nome "Item indisponível" e não quebra a estação. |
| CB-8 | Alguém salva a decoração da estação (etapa 3) enquanto outra pessoa posiciona um item comprado | Sem efeito sobre o item: a posição mora na unidade, não na decoração (D-2). |
| CB-9 | A empresa troca o modelo de estação, e um item comprado fica fora do piso novo ou sobre uma parede | O item não é desenhado e aparece no inventário como "fora da estação — reposicione". A unidade não é apagada. A validação usa a mesma função da RF-9. |
| CB-10 | A estação da empresa é apagada | `onDelete: SetNull` na estação da unidade: ela volta a "disponível" no inventário. |
| CB-11 | A empresa é apagada | `onDelete: Cascade` a partir da organização. |
| CB-12 | O membro perde a permissão no meio de uma movimentação | A procedure confere a permissão na gravação e responde `FORBIDDEN`. No cliente, o item volta à posição salva. |
| CB-13 | Duas pessoas movem a mesma unidade | Controle por versão (`version`): a segunda gravação recebe `CONFLICT` (CA-13). |
| CB-14 | O canal de tempo real está fora do ar | A gravação vale. Os outros veem a mudança ao recarregar. |
| CB-15 | `purchaseKey` reaproveitada para **outro** item | `CONFLICT` com `PURCHASE_KEY_REUSED`. A chave identifica uma intenção de compra e não serve de passe livre. |
| CB-16 | Giro fora dos quartos de volta (0, 90, 180, 270) | O servidor recusa com `INVALID_TRANSFORM`. |
| CB-17 | Outra pessoa retira a unidade da estação enquanto este usuário a move | `CONFLICT` pela versão. O cliente avisa e recarrega o estado. |

## 6. Decisões de design

### D-1 — Uma tabela de unidades compradas, com a posição na própria linha

- **Escolha:** um model novo, `OrbitaStationItem`. Cada linha é **uma unidade comprada**, com dono, preço pago e a transação de STARS. A posição fica em colunas da mesma linha, todas nulas quando a unidade está guardada no inventário.
- **O que já existe e foi olhado no schema:**
  - `WorldEventTicket` é o padrão de "comprei com STARS e guardo a prova", mas é para ingresso.
  - Os models `SpaceStation*` e `WorldGameAsset` são do produto 2D e não entram (ver não-objetivos).
  - Nenhum desses é inventário.
- **Por que é tabela (S4):**
  - A unidade tem ciclo de vida próprio: comprada, posicionada, movida, retirada.
  - A empresa tem N unidades.
  - O inventário é consultado sozinho.
  - O dinheiro pago precisa de prova linha a linha.
- **Alternativas descartadas:**
  - **Contador de quantidade por empresa e item:** perde a ligação com cada transação e não diz qual unidade está onde.
  - **Tabela separada de "posicionamento":** a unidade está em zero ou um lugar, então isso é coluna, não relação.
- **Consequência:** é a decisão mais cara da spec, mas é uma tabela só. O volume é baixo, de dezenas a centenas de linhas por empresa em um ano.

### D-2 — A posição do item comprado não fica na decoração da estação

- **Escolha:** o item comprado é desenhado a partir das linhas de `OrbitaStationItem` e só se junta à estação na tela.
- **Alternativa descartada:** gravar o item comprado dentro do JSON de decoração da estação (etapa 3).
  - Um JSON regravado inteiro permitiria duplicar ou apagar item pago, e um salvamento apagaria o que outra pessoa posicionou (CB-8).
  - Também não daria para validar posição nem contar unidades no banco (S3: `Json` só para dado opaco).
- **Consequência:** a estação tem duas fontes de objetos para desenhar. A junção fica numa função só, com teste.

### D-3 — Catálogo no código, não em tabela

- **Escolha:** `SHOP_CATALOG` é uma constante tipada no domínio. A unidade comprada guarda a `itemKey` e o `pricePaidStars`.
- **Por quê:**
  - Todo item precisa de um modelo `.glb` no repositório (0117, D-4). Item novo já exige deploy, então uma tabela não daria liberdade nenhuma, só um segundo lugar para manter em sincronia com os arquivos.
  - Mudar preço também passa por deploy. É aceitável enquanto o catálogo for pequeno e curado pelo time.
- **Alternativas descartadas:**
  - **Tabela `ShopItem` com tela de admin:** só valeria se itens entrassem sem deploy (upload de modelo pelo admin). Isso não existe e não é pedido.
  - **Usar o `WorldGameAsset`:** é o catálogo da Space Station 2D (D-1 da 0117).
- **Consequência:**
  - Entrada de item vendido nunca é apagada, só marcada `retired` (CB-7).
  - Se o comercial precisar mudar preço sem deploy, a decisão é revista e o catálogo vira tabela. A unidade já guarda o preço pago, então a migração é simples.

### D-4 — Bônus de STARS paga item da loja

- **Escolha:** aceitar bônus, como o `APP_SETUP` (o padrão `allowBonus: true` do `debitStars`).
- **Por quê:** o item é receita da própria plataforma, sem repasse a terceiros. Curso e ingresso recusam bônus porque o dinheiro vai para outra pessoa.
- **Alternativa descartada:** aceitar só saldo pago, como no ingresso. Seria mais restritivo sem motivo de negócio.
- **Pergunta para o comercial:** se a regra for "bônus não paga a loja", basta trocar uma opção.

### D-5 — Débito atômico, sem reaproveitar o `debitStars` como está

- **Escolha:** a compra usa um helper novo em `src/features/stars/lib/`, chamado com o `tx` da compra.
  - Ele trava a linha da empresa com `SELECT … FOR UPDATE` via `tx.$queryRaw`.
  - Depois divide o valor entre saldo pago e bônus e grava a `StarTransaction`, tudo na mesma transação que cria a unidade.
- **Por que não o `debitStars`:**
  - Ele abre a própria transação, então não dá para criar a unidade junto. Um débito sem unidade seria cobrança sem entrega.
  - Ele também tem a disputa de leitura e gravação descrita no §1.
- **Consequência:** o helper novo é o candidato para corrigir o `debitStars` depois, na tarefa separada.

### D-6 — Quem pode o quê

- **Comprar:** Master e Adm (`owner` e `admin`), porque gasta STARS da empresa, como no protótipo. A checagem é por papel dentro da procedure, não só na tela.
- **Posicionar, mover e retirar:** quem pode editar a estação da empresa, ou seja, quem tem **Editar** no app `orbita-station` da matriz de permissões (spec 0119, RF-9).
- **Alternativa descartada:** deixar todo membro comprar. Hoje não existe trava de orçamento por pessoa (não-objetivo), então qualquer membro poderia zerar o saldo da empresa.

### D-7 — Procedures próprias para posicionar, com controle por versão

- **Escolha:** `placeStationItem`, `moveStationItem` e `unplaceStationItem` gravam só a unidade.
  - Cada uma recebe a `version` lida e grava com `where: { id, organizationId, version }`.
  - Se nenhuma linha mudar, a resposta é `CONFLICT`.
- **Alternativa descartada:** "o último a gravar vence". Duas pessoas arrumando a sala ao mesmo tempo perderiam trabalho sem aviso.

### D-8 — Interação no motor 3D, sem lib nova

- **Escolha:**
  - Raycast do Three.js para achar o piso ou o item sob o cursor.
  - Contorno da prévia desenhado pelo motor (borda em `EdgesGeometry` ou o `OutlinePass` do pós-processamento, se o custo couber no nível "médio").
  - Menu de contexto em React por cima do canvas, com os componentes de menu do shadcn que já existem.
- **Alternativa descartada:** uma lib de menu de contexto ou de controles 3D (`TransformControls`). O menu tem três opções, e mover é só no plano do piso. Não justificam dependência nova (S3).

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`)
- [x] Procedures oRPC (contrato de entrada e saída)
- [x] Realtime (a sala do LiveKit da estação, spec 0119)
- [ ] Automações (Inngest): nenhuma (RNF-6)
- [ ] Env vars novas: nenhuma
- [ ] Breaking change para clientes existentes: não
- [x] Documentação: atualizar `docs/orbita-station-overview.md` (criado na 0117)

### Schema (rascunho, a confirmar na implementação)

```prisma
enum StarTransactionType {
  // … valores atuais …
  STATION_ITEM_PURCHASE // débito ao comprar item da Loja Órbita (spec 0118)
}

model OrbitaStationItem {
  id                String   @id @default(cuid())
  organizationId    String   @map("organization_id")
  itemKey           String   @map("item_key") // chave do SHOP_CATALOG (D-3)
  purchasedById     String   @map("purchased_by_id")
  purchaseKey       String   @map("purchase_key")
  pricePaidStars    Int      @map("price_paid_stars")
  starTransactionId String   @unique @map("star_transaction_id")

  // posição: tudo nulo = guardado no inventário
  stationId    String?   @map("station_id")
  x            Float?
  z            Float?
  quarterTurns Int?      @map("quarter_turns") // 0 a 3
  placedById   String?   @map("placed_by_id")
  placedAt     DateTime? @map("placed_at")
  version      Int       @default(0)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  organization    Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  station         OrbitaStation?  @relation(fields: [stationId], references: [id], onDelete: SetNull) // model da etapa 2
  starTransaction StarTransaction @relation(fields: [starTransactionId], references: [id], onDelete: Restrict)

  @@unique([organizationId, purchaseKey])
  @@index([organizationId, itemKey])
  @@index([stationId])
  @@map("orbita_station_items")
}
```

- **Relações de volta:** o Prisma exige o campo do outro lado: `Organization.orbitaStationItems`, `OrbitaStation.items` e `StarTransaction.orbitaStationItem OrbitaStationItem?`. Para `purchasedById` e `placedById`, basta guardar o id, sem relação com `User`.
- **Migration:** só adiciona (um valor de enum e uma tabela) e não toca dados existentes.
- **Valor novo de enum:** no PostgreSQL, ele não pode ser usado na mesma transação em que foi criado. A migration do enum vai separada da que usa o valor, se o `migrate` agrupar as duas.
- **Retenção:** a unidade vive enquanto a empresa existir, sem limpeza periódica, porque o volume é baixo (D-1).

### Procedures (em `src/app/router/orbita-station/`)

| Procedure | Entrada | Regras |
| --- | --- | --- |
| `listShopItems` | categoria opcional | Lê o `SHOP_CATALOG` sem os itens `retired`. Não precisa de banco. |
| `purchaseStationItem` | `itemKey`, `purchaseKey` | D-4, D-5, D-6; `requireStarsMiddleware`; idempotente (RF-3). Recusa `itemKey` inexistente ou `retired`. |
| `listStationInventory` | `stationId` opcional | Agrupado por item; `take` (RNF-4). |
| `placeStationItem` | `itemId`, `stationId`, `x`, `z`, `quarterTurns`, `version` | RF-9, D-6, D-7. |
| `moveStationItem` | `itemId`, `x`, `z`, `quarterTurns`, `version` | Igual ao `place`; só se o item já estiver posicionado. |
| `unplaceStationItem` | `itemId`, `version` | Devolve a unidade ao inventário. |
| Leitura da estação (etapa 2) | — | A leitura da estação passa a devolver também as unidades posicionadas. |

Os nomes seguem a dedução de ação da matriz de permissões: `list*` é Ver; `purchase*`, `place*`, `move*` e `unplace*` são Editar. A checagem de papel para compra (D-6) é extra, dentro da procedure.

### Cliente

- **Hooks** em `src/features/orbita-station/hooks/use-station-items.ts`, seguindo a regra 9 do CLAUDE.md.
- **Catálogo e regra de posição** em `src/features/orbita-station/layout/` (RNF-5).
- **No motor:** raycast, prévia com contorno, menu de contexto, Esc e a junção dos itens comprados com a estação (D-2, D-8).

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-4 | automatizado (procedure + banco de teste) | Compra com saldo e compra sem permissão. Confere saldo, transação e unidade. |
| CA-2, CB-1, CB-15 | automatizado | A mesma `purchaseKey` duas vezes, e a chave reaproveitada para outro item. |
| CA-3, CB-2 | automatizado | Duas compras em `Promise.all` com saldo para uma só. O saldo final nunca fica negativo. |
| CA-5, CA-7, CA-10 | automatizado + manual | Posicionar, mover e ler a estação. No navegador, recarregar e ver o item no lugar. |
| CA-6, CB-9, CB-16 | automatizado (função pura) | Regra de posição com piso, parede, móvel fixo, porta, sobreposição e giro inválido. |
| CB-7 | automatizado | Toda `itemKey` do catálogo tem arquivo `.glb`. |
| CA-9 | automatizado | Ids de outra empresa nas três procedures de posição → `NOT_FOUND`. |
| CA-13, CB-13, CB-17 | automatizado | Duas gravações com a mesma `version`: a segunda recebe `CONFLICT`. |
| CA-8, CA-11, CA-12 | manual (navegador; toque em aparelho real) | Esc, clique fora e toque longo. |

**Observação:** a deriva conhecida (CLAUDE.md, regra 20) diz que não há runner de teste instalado. Os testes automatizados acima dependem da Fase 0 do `docs/arquitetura-evolucao-overview.md`. Até lá, cada CA vira um passo de script em `scripts/` que cita o id do CA.

## 9. Riscos e rollback

- **Cobrança sem entrega:** é o maior risco. A mitigação é fazer o débito e a unidade na mesma transação (D-5): se a criação da unidade falhar, o débito é desfeito junto.
- **Disputa de saldo:** coberta para a compra nova (RNF-1). O `debitStars` e o ingresso de evento continuam com a disputa do §1. **Isso é um achado fora do escopo e deve virar tarefa separada** (S8), com a mesma trava da D-5.
- **Desempenho da estação:** cada item comprado soma objetos à cena 3D. Itens iguais compartilham geometria (cache da 0117, D-4). Com centenas de itens por estação, medir os quadros por segundo no nível "médio" antes de liberar para todos.
- **Rollback:**
  - A migration é reversível (apagar a tabela e o valor de enum) **enquanto não houver compras reais**.
  - Depois da primeira compra, apagar a tabela apaga a prova do que foi pago. Daí em diante, o rollback é esconder a loja no cliente e manter os dados.
  - Por isso a liberação é gradual: primeiro o catálogo com poucos itens, para as empresas internas, e depois o catálogo inteiro.
- **Sem feature flag:** a loja só existe dentro da estação, que só é liberada no menu na etapa 2. Para desligar a loja, marque os itens como `retired` no catálogo. Não é preciso env var nova (S9).

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-27 | João Gabriel (com Claude) | Criada a partir do protótipo Órbita Station 3D (versão 29) |
| 2026-10-27 | João Gabriel (com Claude) | Refeita para o produto novo: sai a Space Station 2D (`WorldGameAsset`, `mapData`, Phaser). O catálogo vai para o código, a posição passa a ser 3D (`x`, `z`, giro), a validação usa a função pura da 0117, e a spec agora depende da 0117 e da etapa 2. Domínio movido para `orbita-station`. |
| 2026-10-28 | João Gabriel (com Claude) | Renumerada de 0116 para 0118: a spec 0116 do trafeGO (PR #481) entrou na `main` antes. |
