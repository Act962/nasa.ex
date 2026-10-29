---
id: 0118
titulo: Órbita Station 3D, etapa 5 — decorar a estação (itens grátis; a Loja Órbita com STARS fica para depois)
dominio: orbita-station
status: em-revisao
autor: João Gabriel (com Claude)
criada: 2026-10-27
atualizada: 2026-10-29
branch: feature/orbita-station-etapa-5-20261029
pr:
peso: completa
---

# 0118 — Órbita Station 3D, etapa 5: decorar a estação

> **Depende de:** [0117](0117-orbita-station-3d-etapa-1.md) (montagem e colisão), [0119](0119-orbita-station-etapa-2-estacao-da-empresa.md) (estação da empresa no banco, permissão `orbita-station` e sala do LiveKit), [0120](0120-orbita-station-etapa-3-salas-ligadas-aos-modulos.md) (salas trancadas) e o "Ir até" com desvio de móveis (`layout/path-finding.ts`).
>
> **Decisão de 2026-10-29 (João Gabriel):** nesta versão **todo item é grátis**. A Loja Órbita com STARS (compra, inventário, débito atômico) fica para quando o time revisar o fluxo de STARS como um todo. O desenho dela está no §11, como referência, mas não foi implementado.

## 1. Contexto

O protótipo validou com o time o fluxo de **decorar a estação**:
- Escolher um item, como um tapete, uma poltrona, uma estante, uma planta ou um console.
- Ver a prévia seguir o cursor, com um contorno que diz se o lugar vale.
- Soltar o item, girá-lo, movê-lo ou tirá-lo da estação.

O protótipo grava tudo no navegador. Para virar produto, foi levantado no código (S1, S4, S5):

- **Não existe nada para decoração no schema.** Os models `SpaceStation*` e `WorldGameAsset` são do produto 2D, que será removido.
- **Os móveis fixos de cada sala** só existiam dentro do código de desenho (`engine/furnish-room.ts`), misturados com Three.js. O servidor não tinha como saber onde ficam as mesas.
- **Modelos 3D:** o repositório tinha 13 móveis. O pacote do protótipo tem 150 modelos CC0 (KayKit Furniture Bits e Kenney Space Station Kit), com textura compartilhada (atlas), e cada um pesa de 3 a 50 KB.
- **Produção sem LiveKit por enquanto:** quem está na estação vê a mudança dos outros ao recarregar.

## 2. Objetivo

Quem pode editar a estação decora as salas e o corredor com itens de um catálogo, de graça. Cada item fica no banco, com a posição validada no servidor pela mesma regra que a prévia usa no navegador.

### Não-objetivos

- **Loja Órbita com STARS** (§11): compra, inventário de comprados e débito atômico.
- **Planta 2D** (desenhar a ordem, a largura e o tipo das salas). A estação continua com os 8 modelos prontos. A planta livre muda a montagem de tudo, então terá spec própria se o time ainda quiser.
- **Itens funcionais** do protótipo (guichê, painel da fila e mesa para 8).
- **Miniaturas dos itens no catálogo.** Por enquanto a lista mostra só o nome; as miniaturas ficam para o polimento.
- **Escala livre e itens na parede.** O item fica no piso, com tamanho fixo, e gira em quartos de volta.
- **Cor do piso e luz por sala.**

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | O catálogo é uma constante no código (`DECOR_CATALOG`, em `layout/decor-catalog.ts`). Cada item tem: chave, nome, categoria, modelo `.glb`, escala, pegada no piso em metros, deslocamento do pivô do modelo e, se for o caso, `isWalkable` (tapete) e `retired`. |
| RF-2 | "Colocar" cria o item direto na posição escolhida. Quem tem **Editar** no app `orbita-station` pode colocar. |
| RF-4 | Colocar é idempotente. O cliente manda uma `requestKey` (UUID gerado ao escolher o item), e repetir a mesma chave devolve o item já criado. |
| RF-7 | **Mover e girar** gravam a nova posição (`x`, `z` e giro em quartos de volta), com quem fez. |
| RF-8 | **Tirar da estação** apaga o item, porque não há o que guardar. |
| RF-9 | O servidor valida a posição com uma função pura (`validatePlacement`, em `layout/decor-placement.ts`), a mesma da prévia no navegador. O item precisa ficar todo no piso de uma sala aberta para quem coloca, ou no corredor. Ele não pode sobrepor parede, móvel fixo ou outro item, nem bloquear porta, a faixa do meio do corredor, o círculo de chegada do Terminal ou a fila de leads do NasaChat. O tapete só precisa estar no piso. |
| RF-10 | **Modo Decorar:** um botão no topo, só para quem tem Editar, abre o painel com o catálogo em cinco categorias. Escolher um item cria a prévia, que segue o cursor sobre o piso em passos de 25 cm. O contorno fica verde quando o lugar é válido e vermelho quando não é, e uma barra mostra o motivo. O clique solta, R gira e Esc cancela. |
| RF-11 | Com o modo Decorar aberto, clicar num item da estação mostra "Mover", "Girar" e "Tirar da estação". Fora do modo Decorar, os itens são só cenário. |
| RF-12 | **Toque:** a prévia segue o centro da tela, e a barra traz os botões "Girar", "Soltar aqui" e "Cancelar". |
| RF-13 | Os itens aparecem para todos que entram na estação. Os que não são tapete bloqueiam o personagem e entram no caminho do "Ir até" como obstáculos. |
| RF-14 | Com o LiveKit ligado, quem muda um item manda o aviso `items` pela sala da estação, e os outros releem os itens. Sem LiveKit, os outros veem a mudança ao recarregar. |
| RF-15 | Um item cuja posição ficou inválida depois de trocar o modelo de estação não é desenhado. Ele aparece em "Fora da estação", no painel, com a opção de tirar. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-3 | Toda procedure filtra pelo `organizationId` da sessão. Um id de outra empresa responde `NOT_FOUND`. |
| RNF-4 | **Limite de 300 itens por estação**, por desempenho da cena. Além disso, colocar responde `LIMIT_REACHED`. |
| RNF-5 | Nenhuma função ou cron no Inngest (S11) e nenhuma env var nova. |
| RNF-6 | Os itens iguais compartilham geometria e textura (cache da 0117, D-4). Os modelos da decoração são baixados só quando aparecem ou são escolhidos, sem pesar a abertura da estação. |
| RNF-7 | Os modelos novos entram em `public/orbita-station/models/furniture/`, com crédito em `CREDITS.txt`. São só os do catálogo (30 itens, cerca de 430 KB), nunca o pacote inteiro. |

## 4. Critérios de aceite

- [x] **CA-2** — Dada a mesma `requestKey` enviada duas vezes, então existe **um** item. _(verificado pela API: as duas respostas devolvem o mesmo id; a chave reaproveitada para outro item responde 409 `REQUEST_KEY_REUSED`.)_
- [ ] **CA-4** — Dado um membro sem **Editar** na estação, quando ele chama colocar, mover ou tirar pela API, então recebe `FORBIDDEN`. O botão do modo Decorar nem aparece para ele.
- [x] **CA-5** — Dado um item solto num lugar válido, quando a página recarrega, então ele está no mesmo lugar e no mesmo giro. _(verificado no navegador com um sofá: solto com clique no piso, girado pelo painel e conferido depois de recarregar.)_
- [x] **CA-6** — Dada uma posição fora do piso, sobre parede, móvel fixo ou outro item, na frente de uma porta, na faixa do corredor, na fila do chat ou numa sala trancada para quem coloca, então a regra recusa com o motivo (`OUT_OF_BOUNDS`, `BLOCKED_AREA`, `OVERLAPS_ITEM`, `BLOCKS_PASSAGE` ou `ROOM_LOCKED`), e nada muda. _(verificado: `scripts/orbita-decor-placement-check.ts`, 14 casos.)_
- [x] **CA-8** — Dada uma prévia aberta, quando a pessoa aperta Esc, então nenhuma gravação acontece. _(verificado: a prévia some e nenhuma chamada de gravação sai.)_
- [ ] **CA-9** — Dado um id de item de outra empresa, quando alguém tenta mover ou tirar, então recebe `NOT_FOUND`. _(um id que não existe na empresa responde 404, e as consultas filtram por `organizationId`. Falta testar com um item real de outra empresa.)_
- [x] **CA-10** — Dadas duas pessoas movendo o mesmo item, então só a primeira grava, e a segunda recebe `CONFLICT`, com o item recarregado. _(verificado pela API com duas gravações da mesma versão: 200 e 409 com o item atual. Tirar com versão velha também responde 409.)_
- [ ] **CA-11** — Dado um sofá colocado no meio de uma sala, quando alguém usa "Ir até" atravessando a sala, então o caminho contorna o sofá.
- [ ] **CA-12** — Dado um aparelho de toque, então a prévia segue o centro da tela, e "Soltar aqui" grava.
- [x] **CA-13** — Dado o catálogo, então toda chave tem o `.glb` correspondente. _(verificado pelo mesmo script: 30 de 30.)_
- [x] **CA-14** — Dada a extração dos móveis fixos para `layout/room-furniture.ts`, então a colisão é idêntica à de antes. _(verificado: as 72 salas dos 8 modelos dão os mesmos obstáculos, na mesma ordem, que o `furnish-room.ts` antigo.)_

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Clique duplo em "Soltar aqui" | A mesma `requestKey` devolve o item existente (RF-4). Dois envios ao mesmo tempo: o segundo cai no índice único e devolve o primeiro. |
| CB-5 | O item sai do catálogo | Só pode ser marcado `retired`: some do catálogo, e os já colocados continuam. Uma chave desconhecida vira uma caixa cinza, sem quebrar a estação. |
| CB-6 | A `requestKey` é reaproveitada para outro item | `CONFLICT` com `REQUEST_KEY_REUSED`. |
| CB-7 | A estação troca de modelo e um item fica fora do piso | RF-15: o item não é desenhado e aparece em "Fora da estação". Ele não é apagado sozinho. |
| CB-8 | A estação ou a empresa é apagada | Os itens caem em cascata. |
| CB-9 | A pessoa perde Editar com o modo Decorar aberto | A gravação responde `FORBIDDEN`, com o aviso na tela. |
| CB-10 | O item é colocado onde um colega está parado | É permitido: a colisão só vale para o próprio personagem, e o colega sai andando. |
| CB-11 | O item é colocado na fila de leads do NasaChat | `BLOCKED_AREA`: a área da fila é reservada. |
| CB-12 | Giro fora de 0 a 3 | `INVALID_TRANSFORM`, e o Zod já barra na entrada da procedure. |
| CB-13 | O limite de 300 é atingido | `LIMIT_REACHED`. O painel também desabilita o catálogo. |
| CB-14 | Um item é colocado onde o personagem de quem coloca está | É permitido. O personagem pode ficar preso; basta andar para fora, porque a colisão só barra a entrada no item. |

## 6. Decisões de design

### D-1 — Uma tabela de itens colocados

- **Escolha:** o model novo `OrbitaStationItem`. Cada linha é um item, com a chave, a posição, o giro, quem criou, quem mexeu por último e a versão.
- **Por que é tabela (S4):** o item tem ciclo de vida próprio (colocado, movido, tirado), a estação tem N itens, e duas pessoas podem mexer ao mesmo tempo.
- **Alternativa descartada: os itens num JSON da estação.** Um salvamento apagaria o que outra pessoa colocou ao mesmo tempo, e não daria para controlar a versão por item.
- **Sem colunas de preço nem de transação de STARS** nesta versão (S9: coluna sem uso não entra). Elas vêm na migration da loja (§11).

### D-2 — Controle por versão por item

- **Escolha:** mover e tirar gravam com `where: { id, organizationId, version }`. Sem linha afetada, a resposta é `CONFLICT`, com o item atual.

### D-3 — Catálogo no código

- **Escolha:** `DECOR_CATALOG` é uma constante tipada. Todo item precisa de um `.glb` no repositório, então item novo já exige deploy, e uma tabela só criaria um segundo lugar para manter em sincronia.
- **As medidas** (pegada e pivô) foram tiradas dos limites de cada `.glb` (o `accessor POSITION`), vezes a escala.

### D-6 — Quem pode o quê

- **Ver os itens:** quem tem **Ver** no app `orbita-station`.
- **Colocar, mover, girar e tirar:** quem tem **Editar**.
- **Os nomes das procedures** (`items.list`, `items.place`, `items.move` e `items.pickUp`) foram escolhidos para a dedução da matriz cair em Ver e Editar. `add…` e `delete…` exigiriam Criar e Excluir, que o Master teria de liberar à parte.

### D-7 — A regra de posição e os móveis fixos são funções puras

- **Escolha:**
  - `validatePlacement` fica em `layout/decor-placement.ts`.
  - A lista de móveis fixos saiu de `furnish-room.ts` para `layout/room-furniture.ts` (`roomFurniture` e `stationObstacles`), com as plantas dos cantos.
  - O desenho, a colisão, o caminho do "Ir até" e o servidor leem a mesma lista.
- **Consequência:** mudar um móvel de lugar é mudar em `room-furniture.ts`, e o desenho em `furnish-room.ts` usa os mesmos helpers (`chatCounter`, `chatWaitingChairs`, `roomColumns`, `fromBackZ`). A extração foi conferida sala a sala (CA-14).

### D-8 — Interação no motor, sem lib nova

- **Escolha:**
  - O raycast do Three.js acha o ponto do piso sob o cursor.
  - O contorno é um `LineLoop` com uma placa translúcida.
  - O painel e a barra são em React.
  - Tudo isso fica numa classe própria, `engine/decor-layer.ts`, para não inchar mais o `station-engine.ts`.

## 7. Impacto

- [x] **Schema e migration:** a tabela `orbita_station_items` (`20261029200000_orbita_station_items`). A migration só cria a tabela.
- [x] **Procedures:** `orbitaStation.items.list`, `.place`, `.move` e `.pickUp`, em `src/app/router/orbita-station/decor-items.ts`.
- [x] **Realtime:** a mensagem `items` na sala do LiveKit, só um aviso para reler.
- [ ] **Inngest e env vars:** nenhum.
- [x] **Documentação:** `docs/orbita-station-overview.md`, o README do protótipo e o `CREDITS.txt`.

### Schema

```prisma
model OrbitaStationItem {
  id             String   @id @default(cuid())
  organizationId String   @map("organization_id")
  stationId      String   @map("station_id")
  itemKey        String   @map("item_key")
  requestKey     String   @map("request_key")
  x              Float
  z              Float
  quarterTurns   Int      @default(0) @map("quarter_turns")
  createdById    String   @map("created_by_id")
  updatedById    String   @map("updated_by_id")
  version        Int      @default(0)
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  station      OrbitaStation @relation(fields: [stationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, requestKey])
  @@index([stationId])
  @@map("orbita_station_items")
}
```

**Volume:** no máximo 300 linhas por estação, sem limpeza periódica.

## 8. Plano de testes

| Critério | Como verificar |
| --- | --- |
| CA-6, CA-13, CB-11, CB-12 | `pnpm exec tsx scripts/orbita-decor-placement-check.ts` |
| CA-14 | Comparação, num script temporário, do `furnish-room.ts` antigo com a lista nova |
| CA-2, CA-9, CA-10 | Chamadas às procedures no banco local |
| CA-4 | Com a conta trocada para membro no banco local, como nas etapas 3 e 4 |
| CA-5, CA-8, CA-11 | No navegador |
| CA-12 | Celular de verdade |

## 9. Riscos e rollback

- **Desempenho:** limite de 300 itens e geometria compartilhada. Medir com muitos itens antes de liberar para clientes.
- **Rollback:** apagar a tabela. Não há dado pago, porque tudo é grátis.
- **Sem feature flag:** a estação ainda não aparece para clientes (fica fechada, só para o Master).

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-27 | João Gabriel (com Claude) | Criada a partir do protótipo Órbita Station 3D (versão 29) |
| 2026-10-27 | João Gabriel (com Claude) | Refeita para o produto novo, sem a Space Station 2D. |
| 2026-10-28 | João Gabriel (com Claude) | Renumerada de 0116 para 0118. |
| 2026-10-29 | João Gabriel (com Claude) | Virou a etapa 5, juntando os itens grátis e a loja numa tabela só. A planta 2D saiu do escopo. |
| 2026-10-29 | João Gabriel (com Claude) | Testada no navegador e pela API (CA-2, CA-5, CA-8 e CA-10). O contorno da prévia ganhou margem, porque do tamanho exato sumia embaixo do item. |
| 2026-10-29 | João Gabriel (com Claude) | **Tudo grátis nesta versão**, a pedido do João Gabriel: a loja com STARS foi para o §11, sem implementar. Sem preço, sem `StarTransaction`, sem inventário; tirar apaga o item. Implementada com os móveis fixos extraídos para `layout/room-furniture.ts` (CA-14), a classe `DecorLayer` e as procedures `items.*`. |

## 11. Adiado: a Loja Órbita com STARS

O desenho abaixo é a referência para quando o fluxo de STARS for revisto. Nada disso foi implementado.

- **Compra:** Master e Adm compram itens exclusivos com STARS da empresa. Cada compra cria uma unidade num inventário, com `pricePaidStars` e `starTransactionId`, que são colunas novas desta tabela, e um tipo novo de `StarTransaction` (`STATION_ITEM_PURCHASE`).
- **Débito atômico:** um helper `debitStarsInTx(tx, …)` trava a linha da empresa com `SELECT … FOR UPDATE`, na mesma transação que cria a unidade. Hoje o `debitStars` e o ingresso de evento leem e gravam o saldo sem trava, e duas compras simultâneas passam as duas pela checagem. A correção deles foi tentada no PR #480, que foi fechado sem merge. **Ela continua pendente.**
- **Itens pagos tirados da estação** voltam ao inventário, sem estorno. `x` e `z` passam a aceitar nulo.
- **Bônus de STARS:** a proposta é que pague a loja, porque é receita da própria plataforma. Isso precisa ser confirmado com o comercial, junto com os preços.
