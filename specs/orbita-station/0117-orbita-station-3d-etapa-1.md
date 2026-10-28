---
id: 0117
titulo: Órbita Station 3D, etapa 1 — a estação do protótipo como código do app, em rota própria e sem banco
dominio: orbita-station
status: em-revisao
autor: João Gabriel (com Claude)
criada: 2026-10-27
atualizada: 2026-10-28
branch: claude/focused-hamilton-2dc35f
pr:
peso: completa
---

# 0117 — Órbita Station 3D, etapa 1: a estação do protótipo vira código do app

## 1. Contexto

O Órbita Station 3D é um **produto novo**: um escritório virtual em 3D onde cada sala corresponde a um módulo da plataforma (NasaChat, Agendas, Financeiro, Tracking…).

- **Não tem relação com a Space Station** (`src/features/space-station/`, 2D em Phaser 4). Não reaproveita a cena, o mapa, os models `SpaceStation*` nem as specs dela. A semelhança é só de ideia.
- **Hoje ele existe só como protótipo**, num artifact do claude.ai (versão 33). A partir dele, o time validou:
  - os 8 modelos de estação;
  - as 11 salas;
  - o personagem;
  - o estúdio do personagem;
  - o acabamento visual.

O protótipo não pode ir para produção como está:

| Como é no protótipo | Por que não serve no produto |
| --- | --- |
| Um arquivo HTML único, com ~5.000 linhas de código | Não tem revisão possível, tipagem nem reuso. Qualquer mudança mexe no arquivo todo. |
| ~8 MB, com os modelos 3D embutidos em texto (base64) | Isso existiu só porque o claude.ai bloqueia baixar arquivos. No app, cada modelo pode ser um arquivo com cache. |
| Three.js r147 carregado de CDN, em versão antiga | Fora do controle de versão do projeto, sem tipos. A API de cor e luz mudou depois da r152. |
| 14 pessoas de exemplo, saldo de exemplo, loja de exemplo | Seria dado falso dentro do produto. |
| Tudo gravado no navegador (`localStorage`) | Serve para a etapa 1, que é individual. Para a empresa toda ver a mesma estação, precisa de banco (etapa 2). |

Esta etapa transforma o protótipo em código do app, sem banco, para que as próximas etapas sejam construídas em cima de uma base revisável:

- **Etapa 2:** a estação da empresa e presença.
- **Spec 0116:** a loja.

## 2. Objetivo

Um usuário logado abre `/orbita-station` e anda pela estação 3D do protótipo. A estação passa a ser desenhada por código modular e tipado do app, com os modelos 3D servidos como arquivos e sem nenhuma tabela nova.

### Não-objetivos

- **Banco de dados.** Nenhuma tabela, coluna ou procedure. O que precisa ser lembrado fica no navegador até a etapa 2 (D-5).
- **Multiplayer e presença.** Só o próprio avatar anda na estação.
- **Pessoas de exemplo.** Os 14 personagens fictícios do protótipo saem. As salas continuam com o nome e o módulo, sem gente.
- **Loja Órbita e STARS.** Ficam com a spec 0116, que depende da etapa 2.
- **Editor de decoração** ("Itens para decorar", cores do piso, luz da sala). A decoração é da empresa: gravar no navegador criaria uma estação diferente para cada pessoa, que se perderia na etapa 2. O editor entra junto com a persistência.
- **Ligar as salas aos módulos reais** (abrir o NasaChat ao entrar na sala). A sala mostra o nome do módulo, como no protótipo. A integração é uma etapa própria.
- **Link no menu da plataforma.** A rota só é acessada por URL até a etapa 2 (D-6).
- **Qualquer mudança na Space Station.**

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | A rota `/orbita-station` exige login. Sem sessão, redireciona para o login, como as outras páginas da plataforma. |
| RF-2 | A estação é montada a partir de um dos 8 modelos de estação do protótipo (`TEMPLATES`), com os 11 tipos de sala (`KINDS`) e os mesmos tamanhos, corredores e portas. |
| RF-3 | O personagem anda com WASD ou setas no computador e com o joystick na tela em aparelho de toque. Ele colide com paredes e móveis sólidos. |
| RF-4 | A primeira entrada já começa com a câmera próxima do personagem. A roda do mouse e a pinça aproximam e afastam a câmera, dentro de um limite. |
| RF-5 | Entrar numa sala mostra o nome dela e o módulo correspondente, com o brilho de entrada no piso (`enterGlow`) do protótipo. |
| RF-6 | O modo mapa mostra a estação de cima, com o nome das salas. Clicar numa sala leva o personagem até a porta dela. |
| RF-7 | O estúdio do personagem (versão 30 do protótipo) troca cores e acessórios, mostra a prévia ao vivo e salva. |
| RF-8 | Trocar o modelo de estação remonta as salas sem recarregar a página. |
| RF-9 | O botão "Print da cena" baixa uma imagem PNG da tela atual. |
| RF-10 | O acabamento visual é o da versão 33: luz ambiente e reflexos (RoomEnvironment), brilho (bloom) só em neon, vidro e telas, texturas de painel e a paleta da Órbita. |
| RF-11 | O nível gráfico tem duas opções: "médio", com brilho, e "leve", sem pós-processamento. Ele cai sozinho para "leve" quando a média dos quadros passa de 25 ms (menos de 40 quadros por segundo). |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | O Three.js e o código da estação só são carregados nessa rota, por import dinâmico no cliente e sem SSR. Nenhuma outra página do app fica maior. |
| RNF-2 | Os modelos 3D ficam em `public/orbita-station/models/` como arquivos `.glb`, só os que a estação usa. Eles são baixados sob demanda e ficam no cache do navegador. A estrutura (paredes, piso, portas) aparece antes de os móveis terminarem de baixar. |
| RNF-3 | O build continua leve (CLAUDE.md, regra 24). Nenhum módulo acessa `window`, `document` ou WebGL no import. O tempo da checagem de tipos no CI não pode subir mais que ~10 s em relação à `main`. |
| RNF-4 | Ao sair da rota, tudo é liberado: renderizador, contexto WebGL, geometrias, materiais, texturas, alvos de pós-processamento, eventos de teclado e de redimensionar. Navegar para fora e voltar não acumula memória nem contextos. |
| RNF-5 | O código mora em `src/features/orbita-station/` e **não importa nada de `src/features/space-station/`**. O motor (Three.js puro) fica separado da interface (React): a interface conversa com o motor por uma API pequena e tipada (D-2). |
| RNF-6 | O estado da interface (painel aberto, nível gráfico, sala atual) fica num store Zustand do domínio (regra 5). |
| RNF-7 | Não há tabela, procedure, função ou cron no Inngest, nem env var nova. |
| RNF-8 | Funciona nos navegadores com WebGL 2. Sem WebGL, a página mostra uma mensagem em vez de tela preta (CB-1). |

## 4. Critérios de aceite

- [x] **CA-1** — Dado um usuário logado, quando ele abre `/orbita-station`, então vê a estação com o personagem na porta de chegada e a câmera próxima, e o console não tem erros. _(verificado no navegador.)_
- [x] **CA-2** — Dado um visitante sem sessão, quando ele abre `/orbita-station`, então é levado ao login. _(verificado: redireciona para `/sign-in`.)_
- [x] **CA-3** — Dado o personagem num corredor, quando o usuário segura W (ou move o joystick num aparelho de toque) em direção a uma parede, então o personagem para na parede e não atravessa. _(verificado no teclado e com arraste real no joystick.)_
- [x] **CA-4** — Dado o modelo "Escritório compacto" escolhido, quando a página é recarregada, então a estação volta com o mesmo modelo. _(verificado.)_
- [x] **CA-5** — Dado um avatar salvo no estúdio, quando a página é recarregada, então o personagem aparece com as mesmas cores e acessórios. _(verificado.)_
- [x] **CA-6** — Dado um ciclo repetido 10 vezes (abrir a estação, ir para outra página do app, voltar), então não aparece o aviso "Too many active WebGL contexts" e a memória JS volta ao patamar inicial depois de uma coleta de lixo, com tolerância de ~10%. _(verificado com 12 ciclos de montar e liberar o motor: nenhum aviso de contexto, memória entre 90 e 119 MB sem tendência de alta.)_
- [ ] **CA-7** — Dado o build de produção, quando a página inicial e o tracking são carregados, então nenhum arquivo JavaScript deles contém o Three.js.
- [ ] **CA-8** — Dado um computador que fica abaixo de 40 quadros por segundo no nível médio, então em poucos segundos a estação passa para "leve" sozinha, e o painel mostra o nível atual.
- [x] **CA-9** — Dada a aba aberta em segundo plano, ou o painel com tamanho zero no carregamento, quando a aba volta a ficar visível, então a estação aparece normalmente, sem tela preta (CB-2). _(verificado com o espaço da estação em tamanho zero e depois redimensionado.)_
- [x] **CA-10** — Dado o código da etapa, então `src/features/orbita-station/` não tem nenhum import de `@/features/space-station`. Verificar com Grep, ou com regra do dependency-cruiser se já houver uma para domínios. _(verificado com Grep.)_
- [ ] **CA-11** — Dado o CI do PR, então o build passa e o tempo de checagem de tipos fica dentro do limite da RNF-3.
- [x] **CA-12** — Comparar, sala por sala, um print do código com um print da versão 33 do protótipo, no mesmo modelo e no mesmo ponto de câmera. Cores, brilho e móveis precisam ser equivalentes. Diferenças pequenas de luz, causadas pela troca de versão do Three.js (D-3), são aceitas e registradas no PR. _(verificado no modo mapa e em Terminal, NasaChat e Copa de perto; diferenças só nas pessoas de exemplo e na decoração salva no protótipo, que estão fora da etapa.)_

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Navegador sem WebGL 2, ou WebGL desligado | Mensagem "Seu navegador não consegue mostrar a estação 3D", com a explicação curta. Nada de tela preta nem erro no console sem tratamento. |
| CB-2 | A página carrega com o canvas de tamanho zero (aba em segundo plano, painel oculto) | Bug conhecido do protótipo: a câmera recebe proporção 0/0, a projeção vira `NaN` e a tela fica preta. **Correção na causa:** não atualizar a câmera nem renderizar enquanto largura ou altura for 0, e redimensionar quando o canvas ganhar tamanho (`ResizeObserver`). |
| CB-3 | `localStorage` indisponível (janela anônima com bloqueio, cota cheia) | A estação abre com o modelo e o avatar padrão. Salvar falha em silêncio, e o estúdio avisa "não foi possível salvar neste navegador". |
| CB-4 | `localStorage` com dado antigo, de outro formato ou corrompido | A chave tem versão (`orbita-station:v1:*`). Dado inválido no schema Zod é ignorado e substituído pelo padrão. Não quebra a página. |
| CB-5 | Um modelo `.glb` falha ao baixar (rede, 404) | O móvel some ou vira uma caixa simples, e o resto da estação continua. Um aviso no console, uma vez por modelo, sem tentar de novo em loop. |
| CB-6 | O usuário sai da rota no meio do carregamento dos modelos | Os carregamentos pendentes são ignorados ao terminar e não adicionam nada a uma cena já liberada. Nada vaza (RNF-4). |
| CB-7 | Teclado com foco num campo de texto (estúdio, busca) | WASD digita no campo e não move o personagem. |
| CB-8 | Aparelho de toque em retrato | O joystick e os painéis cabem na tela, sem rolagem horizontal. Os painéis abrem como folha de baixo. |
| CB-9 | Janela redimensionada ou celular girado | Câmera, renderizador e pós-processamento se ajustam no mesmo quadro, sem distorção. |
| CB-10 | Duas abas da estação abertas | Cada uma funciona sozinha. Salvar o avatar numa aba vale para a outra ao recarregar (o último salvamento vence). Não há sincronização ao vivo nesta etapa. |
| CB-11 | Monitor de alta densidade (pixel ratio 3) | A densidade de pixels fica limitada a 2, para não multiplicar o custo do brilho. |
| CB-12 | O modelo escolhido sai de uma versão futura da lista | A chave salva não existe mais: volta para o modelo padrão. |

## 6. Decisões de design

### D-1 — Produto e domínio novos, separados da Space Station

- **Escolha:**
  - O domínio é `src/features/orbita-station/` e a rota é `src/app/(platform)/orbita-station/`.
  - Nada é importado do Space Station, nem no código nem nas specs. Esta spec abre a pasta `specs/orbita-station/`.
- **Alternativa descartada:** construir em cima do `space-station`, trocando o motor da cena. Os dois produtos têm objetivos diferentes, e o dono do produto decidiu que este é novo. Misturar prenderia o 3D às regras, aos dados e ao editor de quadradinhos do 2D.
- **Consequência:**
  - Enquanto os dois existirem, haverá dois motores no app: Phaser no 2D e Three.js no 3D.
  - O que fazer com o Space Station é uma decisão de produto fora desta spec.

### D-2 — Three.js puro no motor, React só na interface

- **Escolha:**
  - **Motor:** uma classe `StationEngine` em `src/features/orbita-station/engine/`, sem React. Ela cria a cena, o loop, os controles e o acabamento.
  - **Interface (React + Tailwind + shadcn):** o HUD, os painéis (estúdio, modelos, mapa) e o joystick.
  - **Ligação:** a interface chama métodos tipados do motor (`setTemplate`, `setAvatar`, `setQuality`, `openMap`, `capture`, `dispose`) e escuta eventos tipados (`roomEnter`, `qualityChange`, `ready`).
- **Alternativa descartada:** `@react-three/fiber`. É uma boa biblioteca, mas obrigaria a reescrever as ~5.000 linhas no formato declarativo do React, com risco alto de mudar o comportamento. Também acrescentaria mais duas dependências (fiber e drei). Portar a lógica imperativa que já foi validada custa menos e é mais seguro.
- **Consequência:** o motor pode ser testado e medido sem React. A regra de colisão e a montagem das salas são funções puras, testáveis sem WebGL.

### D-3 — Three.js atual pelo npm, não a r147 do protótipo

- **Escolha:** `three` na versão estável atual, com os extras (EffectComposer, UnrealBloomPass, RoomEnvironment, GLTFLoader) importados de `three/addons`. Tipos via `@types/three`.
- **Por quê:** a r147 tem mais de três anos e não recebe correções. A API de cor mudou na r152: `outputEncoding` virou `outputColorSpace`, `encoding` virou `colorSpace` e `ColorManagement.legacyMode` virou `enabled`.
- **Consequência:**
  - A partir da r155 a intensidade das luzes usa unidades físicas, então as luzes do protótipo precisam ser recalibradas.
  - O critério CA-12 existe para pegar essa diferença.
  - **Achado na implementação:** desde a r163, com o reflexo vindo de `scene.environment`, o Three.js usa `scene.environmentIntensity` e ignora o `envMapIntensity` do material. Na r180 a cena saiu ~4,5x mais clara que o protótipo, com o piso estourado. Por isso o motor define `scene.environmentIntensity = 0,22` (o valor padrão do protótipo), e os materiais com intensidade própria (vidro, capacete, visor) recebem o mapa direto em `envMap`.
  - É lib nova no projeto (S3). Ela se justifica porque nenhuma dependência atual faz 3D: o Phaser é 2D.

### D-4 — Modelos como arquivos estáticos, só os usados

- **Escolha:**
  - Copiar para `public/orbita-station/models/` os `.glb` que a estação realmente usa: o avatar, os móveis do KayKit Furniture Bits e as peças do Kenney Space Station Kit.
  - Carregar com `GLTFLoader` e manter um cache por modelo, para que dez mesas iguais usem uma geometria só.
- **Alternativas descartadas:**
  - **Base64 dentro do código:** infla o bundle e não usa o cache do navegador.
  - **R2/S3:** acrescentaria infraestrutura a algo que é um asset fixo do produto, não um upload de usuário.
- **Consequência:**
  - O repositório ganha alguns MB de binários: hoje são ~0,6 MB de avatar e algo como 3 a 5 MB de móveis.
  - Antes de copiar, conferir a licença dos pacotes. KayKit e Kenney são CC0, mas isso precisa ser confirmado com o arquivo de licença de cada pacote e registrado no PR.

### D-5 — O que precisa ser lembrado fica no navegador, só nesta etapa

- **Escolha:** o modelo de estação escolhido e o avatar ficam no `localStorage`, com chave versionada e validação Zod (CB-4). Nada vai para o servidor.
- **Por quê:**
  - Sem banco, a etapa 1 não tem migration, procedure nem dado de produção, e é fácil de desfazer.
  - O avatar é pessoal. Por isso ele é o único dado desta etapa que precisa sobreviver: na etapa 2 o cliente lê a chave uma vez e envia para o servidor.
- **Consequência:**
  - O modelo de estação é escolhido por pessoa nesta etapa. Na etapa 2 ele passa a ser da empresa e a escolha local é descartada.
  - Isso é aceitável porque a rota ainda não está no menu (D-6).

### D-6 — Sem feature flag: a rota fica fora do menu

- **Escolha:** nenhuma env var. A rota existe, exige login e não aparece no menu nem em nenhum link até a etapa 2.
- **Alternativa descartada:** `NEXT_PUBLIC_ORBITA_STATION`. Sem banco e sem dado sensível, o pior caso de alguém achar a URL é ver uma estação vazia. Um flag criaria dois caminhos para manter e precisaria do secret `NEXT_PUBLIC_ENV` no build (regra 24b), sem proteger nada (S9).
- **Consequência:**
  - Ligar a rota no menu é a "liberação" desta funcionalidade, e acontece na etapa 2.
  - Se algum dia a rota precisar ficar restrita, isso vira permissão de app, não flag.

## 7. Impacto

- [ ] Schema / migration: nenhum.
- [ ] Procedures oRPC: nenhuma.
- [ ] Realtime: nenhum.
- [ ] Automações (Inngest): nenhuma.
- [ ] Env vars novas: nenhuma.
- [ ] Breaking change: não. A rota é nova e nada existente muda.
- [x] **Dependências novas:** `three` e `@types/three` (D-3).
- [x] **Assets novos:** `.glb` em `public/orbita-station/models/` (D-4).
- [x] **Documentação:** criar `docs/orbita-station-overview.md`, com a visão do produto, as etapas e a API do motor. Ele deve ser mantido junto com o código, como os overviews das regras 10, 14 e 19.

### Estrutura proposta

```
src/features/orbita-station/
├── engine/          # Three.js puro: StationEngine, cena, câmera, controles, acabamento, carregador de modelos
├── layout/          # funções puras: modelos de estação, tipos de sala, montagem e colisão (testáveis sem WebGL)
├── components/      # React: canvas, HUD, estúdio, painel de modelos, mapa, joystick, aviso sem WebGL
├── store/           # Zustand do HUD
├── lib/             # leitura e gravação no navegador com Zod (D-5)
└── types.ts
src/app/(platform)/orbita-station/page.tsx   # carrega o canvas com import dinâmico, sem SSR (RNF-1)
public/orbita-station/models/*.glb
```

### Ordem sugerida de implementação (PRs pequenos, cada um revisável)

1. `layout/`: modelos, salas, montagem e colisão como funções puras, com os testes de colisão.
2. `engine/`: cena, estrutura, personagem, controles e câmera, com a liberação de recursos (RNF-4), e a rota com o canvas.
3. Modelos `.glb`, carregador com cache e móveis.
4. Acabamento (RF-10, RF-11), com a recalibração da D-3 e o CA-12.
5. Interface: modelos, mapa, estúdio, print, joystick e o aviso sem WebGL.

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-3 | automatizado (função pura) | Colisão em `layout/`: posições contra paredes, portas e móveis sólidos. |
| CA-4, CA-5, CB-3, CB-4, CB-12 | automatizado (função pura) | Leitura e gravação do navegador com dado válido, antigo, corrompido e ausente. |
| CA-1, CA-2, CA-8, CA-9 | manual (navegador) | Abrir logado e deslogado, forçar o nível leve e abrir com a aba em segundo plano. |
| CA-6 | manual (DevTools, memória) | Dez ciclos de ida e volta com snapshot de memória antes e depois. |
| CA-7, CA-11 | CI | Analisar os bundles do build e olhar o tempo do `Finished TypeScript` no log. |
| CA-10 | automatizado | Grep, ou regra do dependency-cruiser. |
| CA-12 | manual | Prints lado a lado em cada sala, anexados ao PR. |
| CB-1, CB-8 | manual | WebGL desligado nas flags do navegador e celular real em retrato. |

**Observação:** a deriva conhecida (CLAUDE.md, regra 20) diz que não há runner de teste instalado. Até a Fase 0 do `docs/arquitetura-evolucao-overview.md`, os testes de função pura viram scripts em `scripts/`, rodados via `tsx`, que citam o id do CA.

## 9. Riscos e rollback

- **Visual diferente do protótipo (D-3):** a troca de versão do Three.js muda luz e cor. Mitigação: o CA-12 e a recalibração no PR 4. Se não ficar equivalente, o PR registra as diferenças em vez de esconder.
- **Peso da página:** o Three.js tem ~150 KB comprimido e os modelos alguns MB. Fica restrito à rota (RNF-1), e os modelos usam o cache do navegador. Medir o primeiro carregamento numa rede 4G simulada e registrar no PR.
- **Celular fraco:** o protótipo nunca foi testado num aparelho real. O nível leve automático (RF-11) é a defesa. O teste em celular real é obrigatório antes da etapa 2 ligar a rota no menu.
- **Vazamento de memória em navegação SPA:** é o erro típico de Three.js dentro de React. Coberto pela RNF-4 e pelo CA-6.
- **Tempo de build:** `@types/three` é grande. O CA-11 mede, e passou do limite, roda o "Typecheck diagnostics" antes de aceitar (regra 24g).
- **Rollback:** apagar a rota, a pasta do domínio, os modelos e as duas dependências. Não há dado nem migration para desfazer.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-27 | João Gabriel (com Claude) | Criada a partir do protótipo Órbita Station 3D (versão 33) |
| 2026-10-27 | João Gabriel (com Claude) | Rota fora do grupo `(tracking)`: a estação ocupa a tela toda, sem a barra lateral. D-3 ganha o achado da intensidade do reflexo na r163. |
| 2026-10-28 | João Gabriel (com Claude) | Em revisão. Estúdio e mapa implementados; critérios verificados marcados. CA-7 e CA-11 dependem do CI do PR; CA-8 não foi reproduzido numa máquina lenta de verdade. Enquadramento do mapa calculado pelos cantos da estação (com o celular em pé, o cálculo do protótipo cortava as pontas). |
