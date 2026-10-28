---
id: 0119
titulo: Órbita Station 3D, etapa 2 — a estação da empresa no banco, avatar no servidor e colegas ao vivo
dominio: orbita-station
status: rascunho
autor: João Gabriel (com Claude)
criada: 2026-10-28
atualizada: 2026-10-28
branch: claude/focused-hamilton-2dc35f
pr:
peso: completa
---

# 0119 — Órbita Station 3D, etapa 2: a estação da empresa, o avatar no servidor e os colegas ao vivo

> **Depende de:** [0117](0117-orbita-station-3d-etapa-1.md), PR #482.
> **Bloqueia:** [0118](0118-loja-orbita-itens-na-estacao.md) (loja), que precisa da estação da empresa no banco.

## 1. Contexto

A etapa 1 colocou a estação 3D no app, mas ela ainda é individual:

| Hoje (etapa 1) | Problema para virar produto |
| --- | --- |
| O modelo de estação fica no navegador de cada pessoa. | Cada colaborador vê uma estação diferente. A estação deveria ser da empresa. |
| O avatar fica no navegador. | Trocar de computador perde o personagem, e ninguém mais vê como ele é. |
| Só o próprio personagem anda na estação. | O valor do produto é ver a equipe trabalhando junto, e isso não existe. |
| A rota não está no menu nem na matriz de permissões. | Ninguém encontra a estação, e o Master não controla quem entra. |

O que foi levantado no código antes de propor (S1, S4):

- **Tempo real:** o app tem Pusher e LiveKit.
  - **Pusher:** canais `presence-*` são liberados para **qualquer usuário, inclusive visitante** (`src/app/api/pusher/auth/route.ts`). Um canal de presença por empresa vazaria quem está online para outras empresas. Canal privado exige um `ChannelAuthorizer` (`src/lib/realtime/channel-authorizers.ts`).
  - **LiveKit:** já está no app, com tokens emitidos por `src/lib/livekit/server.ts`. O LiveKit Cloud que era usado acabava rápido, então o servidor vai para a nossa VPS, pelo Coolify ([docs/livekit-self-hosted.md](../../docs/livekit-self-hosted.md)).
- **Avatar:** não há nada reaproveitável no schema.
- **Permissões:** a matriz é o catálogo `src/features/permissions/lib/app-permission-catalog.ts`. A `orbita-station` ainda não está lá.
- **Sync com o NERP:** o `User` é replicado por uma **lista explícita de campos** (`src/features/sync/lib/inbound.ts`). Uma coluna nova em `User` não entra no sync nem quebra nada.
- **Uso esperado no início:** até ~20 pessoas ativas ao mesmo tempo, somando todas as empresas.

## 2. Objetivo

Cada empresa tem **uma** estação no banco, igual para todos. O avatar de cada pessoa fica no servidor. Quem está na estação vê os colegas andando nela ao vivo, só da própria empresa. O Master libera o acesso pela matriz de permissões, e a estação ganha link no menu.

### Não-objetivos

- **Editor de decoração** (itens grátis, cor do piso, luz). Vai para a etapa 3, junto com a loja (0118): os dois põem objetos na estação e usam a mesma regra de posição. Fazer o editor antes criaria um JSON de decoração que a loja teria de desmontar.
- **Salas trancadas por permissão** (a porta trancada do protótipo). Precisa de regra de acesso por sala, que é uma decisão de produto própria.
- **Ligar as salas aos módulos reais** (entrar na sala do NasaChat abre o NasaChat).
- **Voz, vídeo e chat** entre colegas. O LiveKit escolhido na D-3 deixa isso possível depois, mas não entra agora.
- **Guardar a posição** de cada pessoa. Ao entrar, todo mundo nasce no Terminal de Chegada.
- **Visitante sem login** e estação pública.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Cada empresa tem uma estação. Ela é criada no primeiro acesso, com o modelo padrão "completo". |
| RF-2 | Quem tem **Editar** no app `orbita-station` troca o modelo de estação e renomeia as salas. A mudança vale para todos. |
| RF-3 | Quem está na estação quando ela muda vê as salas remontarem sem recarregar. Quem fica fora do piso novo volta ao Terminal. |
| RF-4 | O avatar é salvo no servidor, por pessoa, e vale em qualquer computador e em qualquer empresa da qual ela participe. |
| RF-5 | Na primeira entrada da etapa 2, o avatar salvo no navegador pela etapa 1 é enviado ao servidor uma vez, se o servidor ainda não tiver um. |
| RF-6 | A estação mostra os colegas da mesma empresa que estão nela agora, com o avatar e o primeiro nome em cima do personagem. |
| RF-7 | O movimento dos colegas aparece suave: o cliente interpola entre as posições recebidas. |
| RF-8 | Quem fecha a aba, perde a conexão ou sai da empresa ativa some da estação dos outros em até ~15 s. |
| RF-9 | O app `orbita-station` entra na matriz de permissões: **Ver** entra na estação e **Editar** muda o modelo e o nome das salas. |
| RF-10 | A estação entra na página Apps e pode ser posta no menu lateral, como os outros apps. Quem não tem **Ver** e abre a rota vê "você ainda não tem acesso", com a orientação de pedir ao Master. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Toda leitura e gravação filtra pelo `organizationId` da sessão. Id de outra empresa responde `NOT_FOUND`. |
| RNF-2 | Ninguém de outra empresa vê nem ouve a presença de uma estação. A sala de tempo real é fechada por token emitido no servidor, depois de checar a empresa e a permissão **Ver** (D-3). |
| RNF-3 | Posição só é enviada enquanto a pessoa anda, no máximo 10 vezes por segundo, e nunca passa pelo servidor do app (D-3). Parado, não envia nada. |
| RNF-4 | Limite de 30 pessoas ao mesmo tempo por estação (`max_participants` do servidor do LiveKit). A 31ª vê o aviso "a estação está cheia agora" e não entra na sala de tempo real. |
| RNF-5 | Nenhuma função ou cron no Inngest (S11). |
| RNF-6 | O avatar e os nomes das salas são validados com Zod no servidor antes de gravar. JSON inválido vindo do banco vira o padrão, sem derrubar a página. |
| RNF-7 | O código continua sem importar nada de `src/features/space-station/` (0117, CA-10). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dada uma empresa sem estação, quando o primeiro membro abre `/orbita-station`, então existe uma `OrbitaStation` com o modelo "completo" e ele vê essa estação.
- [ ] **CA-2** — Dado um Master que troca o modelo para "Escritório compacto", quando outro membro abre a estação em outro computador, então vê o "Escritório compacto".
- [ ] **CA-3** — Dadas duas pessoas na estação, quando o Master troca o modelo, então a outra pessoa vê as salas remontarem em poucos segundos, sem recarregar.
- [ ] **CA-4** — Dado um membro sem **Editar**, quando ele chama a procedure de troca de modelo direto pela API, então recebe `FORBIDDEN` e nada muda.
- [ ] **CA-5** — Dado um avatar salvo num computador, quando a mesma pessoa abre a estação em outro computador, então o personagem aparece igual.
- [ ] **CA-6** — Dado um avatar salvo só no navegador pela etapa 1, quando a pessoa entra na etapa 2, então ele vai para o servidor uma vez, e o estúdio não reabre como "primeira visita".
- [ ] **CA-7** — Dadas duas pessoas da mesma empresa na estação, quando uma anda, então a outra vê o personagem dela andando, com o nome em cima.
- [ ] **CA-8** — Dadas duas empresas com gente na estação ao mesmo tempo, então ninguém de uma vê ninguém da outra. Um token pedido com o id de outra empresa responde `NOT_FOUND`.
- [ ] **CA-9** — Dada uma pessoa que fecha a aba, então ela some da estação dos outros em até ~15 s.
- [ ] **CA-10** — Dado um membro sem **Ver** no app `orbita-station`, quando ele abre `/orbita-station`, então vê "você ainda não tem acesso", sem carregar o 3D. As procedures da estação respondem `FORBIDDEN`.
- [ ] **CA-11** — Dada uma pessoa parada, então nenhuma mensagem de posição sai do navegador dela (conferido no painel de rede ou no log da sala).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Dois membros abrem a estação pela primeira vez ao mesmo tempo | `@@unique(organizationId)` e `upsert`: uma estação só. O segundo lê a que o primeiro criou. |
| CB-2 | Dois admins trocam o modelo ao mesmo tempo | Controle por `version`. O segundo recebe `CONFLICT` e vê o modelo novo. |
| CB-3 | A mesma pessoa abre a estação em duas abas | A identidade na sala é o `userId`. A segunda aba assume, e a primeira mostra "a estação foi aberta em outra aba", com um botão para voltar. Não aparecem dois personagens iguais. |
| CB-4 | A pessoa troca a empresa ativa com a estação aberta | Sai da sala da empresa antiga e entra na nova, com a estação nova. |
| CB-5 | A pessoa é removida da empresa com a estação aberta | O token vale 15 minutos. Na renovação, o servidor recusa e ela é desconectada. Fica exposta, no máximo, a presença por até 15 min (registrado em §9). |
| CB-6 | O Master tira o **Ver** de alguém com a estação aberta | Mesmo caminho do CB-5: recusa na renovação do token. |
| CB-7 | O LiveKit está fora do ar ou não configurado no ambiente | A estação abre sozinha, como na etapa 1, com o aviso "colegas indisponíveis agora". Modelo e avatar continuam vindo do banco. |
| CB-8 | O avatar no banco é inválido (formato antigo ou campo removido) | Zod recusa, e o personagem usa o visual padrão da pessoa. O estúdio abre com esse padrão. |
| CB-9 | O nome de sala renomeada fica vazio ou passa de 40 caracteres | O servidor recusa com `BAD_REQUEST`. Nome vazio volta ao nome do tipo da sala. |
| CB-10 | O modelo muda e uma sala renomeada deixa de existir | Os nomes ficam guardados pela chave da sala (`top-0`, `bottom-2`). Chave que não existe no modelo novo é ignorada e não é apagada: se o modelo voltar, o nome volta. |
| CB-11 | Mensagem de posição chega fora de ordem ou se perde | As mensagens levam um número de sequência. Mensagem mais velha que a última recebida é ignorada, e perdas são compensadas pela interpolação. |
| CB-12 | A conexão cai e volta | O cliente reconecta sozinho, pede token novo e reaparece no ponto onde estava, não no Terminal. |
| CB-13 | A 31ª pessoa entra (RNF-4) | A estação abre sem colegas, com o aviso. Ela tenta de novo quando alguém sai, sem loop: no máximo uma vez por minuto. |

## 6. Decisões de design

### D-1 — Uma tabela `OrbitaStation`, uma linha por empresa

- **Escolha:** um model novo, `OrbitaStation`, com `organizationId` único, `templateKey`, `roomNames` (JSON) e `version`.
- **Por que tabela, e não colunas em `Organization` (S4):**
  - A loja (0118) tem chave estrangeira para a estação, e o editor de decoração da etapa 3 grava nela. Ela é um objeto com ciclo de vida próprio.
  - A estação precisa de controle de versão próprio (CB-2).
  - O `Organization` já é grande e é replicado com o NERP. Somar colunas de um produto novo nele mistura domínios.
- **Por que `roomNames` é JSON (S3):** é um mapa pequeno (chave da sala → nome), editado inteiro por quem administra e nunca filtrado, somado ou ordenado no banco. É configuração livre do usuário, validada com Zod. Uma tabela de nomes de sala seria um join sem uso.

### D-2 — Avatar numa coluna de `User`

- **Escolha:** `User.orbitaAvatar Json?`, validado por `avatarLookSchema` (o mesmo Zod da etapa 1, em `lib/avatar-look.ts`).
- **Por que coluna (S4):** o avatar é 1:1 com a pessoa, não tem ciclo de vida próprio e não é consultado sozinho. O sync com o NERP usa lista explícita de campos (ver §1), então a coluna nova não vaza para lá.
- **Por que JSON:** é a configuração visual de 10 campos, gravada e lida sempre inteira, nunca filtrada.
- **Alternativa descartada:** uma tabela `OrbitaAvatar`. Seria um join para um dado 1:1.
- **Consequência:** o avatar vale em todas as empresas da pessoa, e é isso que se espera de um personagem.

### D-3 — Presença e movimento pelo LiveKit na nossa VPS, não pelo Pusher

- **Escolha:** uma sala do LiveKit por estação (`orbita:<organizationId>`), num servidor do LiveKit nosso, na VPS, pelo Coolify ([docs/livekit-self-hosted.md](../../docs/livekit-self-hosted.md)).
  - **Presença:** quem está na sala.
  - **Posição:** mensagens de dados do LiveKit (`publishData`, modo sem garantia de entrega), de pessoa para pessoa através do servidor do LiveKit, sem passar pelo Next.
  - **Mudança de modelo e de avatar:** mensagem de dados com garantia de entrega.
  - **Token:** emitido por uma procedure que confere sessão, empresa ativa e permissão **Ver**. Ele vale 15 minutos e é renovado pelo cliente.
- **Por que não o Pusher, com números:** imagine 15 pessoas na estação, com 6 andando ao mesmo tempo a 6 posições por segundo.
  - São 36 posições por segundo, cada uma entregue a 14 ouvintes: **cerca de 500 mensagens do Pusher por segundo**, ou 1,8 milhão por hora. O Pusher cobra por mensagem entregue a cada ouvinte.
  - Os canais de presença do Pusher, como estão hoje, também vazariam a presença entre empresas (§1).
- **Por que na nossa VPS, e não no LiveKit Cloud:** o Cloud cobra por minuto de conexão e acabava rápido. Com 20 pessoas trocando só posições (~20 bytes cada), um servidor pequeno dá conta, e o custo é só o da VPS.
- **Bônus:** a mesma sala abre caminho para voz e vídeo depois, sem segunda infraestrutura. Com vídeo, o consumo de banda sobe bastante e precisa ser medido antes.
- **Pré-requisito da implementação:** o servidor do LiveKit no ar, com as portas 7881/tcp e 50000–50100/udp abertas na VPS.

### D-4 — Liberação pela matriz de permissões, sem feature flag

- **Escolha:**
  - Entrada nova `orbita-station` no catálogo da matriz.
  - **Padrão:** **Ver** e **Editar** só para o Master; os demais papéis começam sem acesso.
  - O Master libera para a equipe quando quiser.
  - O link no menu respeita o **Ver**.
- **Por que (S9):** a liberação gradual fica por empresa e nas mãos de cada Master, sem env var que alguém precise lembrar de apagar.
- **Alternativa descartada:** `NEXT_PUBLIC_ORBITA_STATION`. Seria liga ou desliga para todas as empresas ao mesmo tempo e exigiria o secret no build (regra 24b).

### D-5 — Posição não é gravada

- **Escolha:** a posição vive só na sala de tempo real. Ao entrar, todo mundo nasce no Terminal (CB-12 é a exceção: reconexão).
- **Por quê:** gravar posição seria uma escrita no banco a cada passo, ou um cron para salvar. Não há pedido de produto para "voltar onde parei".

## 7. Impacto

- [x] **Schema / migration:** model novo `OrbitaStation` e coluna `User.orbitaAvatar`.
- [x] **Procedures oRPC:**
  - `orbitaStation.get` (cria se não existir);
  - `orbitaStation.update` (modelo e nomes, com `version`);
  - `orbitaStation.saveAvatar`;
  - `orbitaStation.joinToken`.
  Ficam em `src/app/router/orbita-station/`, com os hooks em `src/features/orbita-station/hooks/` (regra 9).
- [x] **Realtime:** LiveKit, sala por estação (D-3). Pusher não é usado.
- [ ] **Automações (Inngest):** nenhuma.
- [ ] **Env vars novas:** nenhuma. Usa as do LiveKit que já existem (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL`).
- [x] **Permissões:** entrada `orbita-station` no catálogo, com dicas das ações.
- [x] **Menu:** a Órbita Station entra no catálogo da página Apps e na lista do menu lateral (`src/features/apps/`), escondida por padrão como os outros apps.
- [ ] **Breaking change:** não.
- [x] **Documentação:** `docs/orbita-station-overview.md`.

### Schema (rascunho, a confirmar na implementação)

```prisma
model OrbitaStation {
  id             String   @id @default(cuid())
  organizationId String   @unique @map("organization_id")
  templateKey    String   @default("completo") @map("template_key")
  roomNames      Json?    @map("room_names") // { "top-0": "Recepção VIP" } — validado com Zod
  version        Int      @default(0)
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("orbita_stations")
}

model User {
  // … campos atuais …
  orbitaAvatar Json? @map("orbita_avatar") // visual do personagem na Órbita Station — validado com Zod
}
```

- **Migration:** só adiciona (uma tabela e uma coluna nula). Não toca dados existentes e é reversível.
- **Volume:** uma linha por empresa, sem limpeza periódica.
- **Índices:** o `@unique(organizationId)` cobre a única consulta.
- **Retenção:** a estação some com a empresa (`onDelete: Cascade`); o avatar, com o usuário.

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CB-1 | automatizado | Duas chamadas simultâneas de `get` para a mesma empresa: uma linha só. |
| CA-2, CA-4, CB-2 | automatizado | `update` com e sem **Editar**, e com `version` velha. |
| CA-5, CA-6, CB-8 | automatizado + manual | `saveAvatar` com visual válido e inválido; migração da etapa 1 no navegador. |
| CA-8 | automatizado | `joinToken` com empresa ativa diferente do pedido → `NOT_FOUND`. O token traz só a sala da própria empresa. |
| CA-3, CA-7, CA-9, CB-3, CB-12 | manual | Duas janelas com contas diferentes da mesma empresa, e uma terceira de outra empresa. |
| CA-10 | manual | Membro sem **Ver**: sem link no menu e a rota mostra "sem acesso". |
| CA-11 | manual | Painel de rede ou log de dados da sala com a pessoa parada. |
| RNF-4, CB-13 | manual | Sala com limite baixo no ambiente de teste. |

**Observação:** continua sem runner de teste (CLAUDE.md, regra 20). Os casos automatizados viram scripts em `scripts/`, rodados via `tsx`, citando o CA.

## 9. Riscos e rollback

- **LiveKit na VPS (D-3):** ainda precisa ser instalado. Se a VPS cair, a estação abre sem os colegas (CB-7). Redes corporativas que bloqueiam UDP e a porta 7881 não conectam: a solução é o TURN na porta 443, que só será ligado se o caso aparecer.
- **Exposição depois de sair da empresa (CB-5):** até 15 min vendo quem está online. Encurtar o token aumenta as renovações. Se o produto exigir corte imediato, a remoção de membro passa a chamar a remoção do participante no LiveKit, por evento e não por cron.
- **Desempenho com muita gente:** cada colega é um personagem com animação. Medir os quadros por segundo com 20 personagens no nível "médio" antes de liberar. Se pesar, colegas longe ficam sem animação.
- **Rollback:** o Master tira o **Ver** da equipe, e a estação some do menu. A migration é reversível (apagar a tabela e a coluna) enquanto a loja (0118) não depender dela.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-28 | João Gabriel (com Claude) | Criada, com o parecer da etapa 2 |
| 2026-10-28 | João Gabriel (com Claude) | RF-10 ajustado na implementação: o menu lateral do app não filtra nenhum app por permissão, e criar esse filtro só para a estação mudaria o menu inteiro (S8). A estação segue o padrão dos outros apps (página Apps + menu opcional), e a barreira de acesso é a página e as procedures. |
| 2026-10-28 | João Gabriel (com Claude) | LiveKit decidido: servidor próprio na VPS (Coolify), não o Cloud. Limite por estação de 30 pessoas (uso esperado: até 20). Saem as referências à Space Station 2D, que será removida quando o 3D estiver pronto. |
