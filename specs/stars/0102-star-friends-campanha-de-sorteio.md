---
id: 0102
titulo: Campanha de sorteio por cupom no STAR FRIENDS, atendida pelo WhatsApp
dominio: stars
status: em-revisao
autor: Weydson
criada: 2026-10-13
atualizada: 2026-10-13
branch: feature/W-star-friends-campanha-sorteio-20261013
pr:
peso: completa
---

# 0102 — Campanha de sorteio por cupom no STAR FRIENDS

## 1. Contexto

O Mercadinho Preço Baixo faz 15 anos e quer a campanha "Comprou, Participou!": a cada R$ 100 em compras, 1 número da sorte. O cliente manda a foto do cupom no WhatsApp oficial e recebe os números na conversa.

O STAR FRIENDS hoje só credita stars de compras do Catálogo online e do Forge. Não tem campanha, cupom nem número da sorte. O `sha256` e o tamanho da mídia que a Meta entrega são descartados, então a mesma foto pode ser reenviada sem ninguém notar. A assistente do atendimento não lê imagem.

## 2. Objetivo

Uma empresa com STAR FRIENDS cria uma campanha de sorteio, o cliente participa sozinho pelo WhatsApp enviando o cupom, e a empresa sorteia entre números válidos depois de uma varredura de duplicados.

### Não-objetivos

- Fluxo editável em Gatilhos Automáticos para a campanha (as regras são fixas no código, D-1).
- Conferência manual de todo cupom antes de liberar os números (D-4). Só o cupom que a leitura automática não resolveu vai para conferência (RF-15).
- Hash perceptual da imagem (D-5).
- Autorização legal do sorteio (SPA/Ministério da Fazenda): é responsabilidade da empresa; o regulamento tem campo para o número do certificado.
- Aviso do resultado fora da janela de 24 h (exige template aprovado; fica para depois).
- Mais de uma campanha ativa ao mesmo tempo na mesma empresa.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | A empresa cria uma campanha no STAR FRIENDS: nome, período, valor por número (padrão R$ 100), CNPJs aceitos, resumo das regras, link do regulamento, funil do WhatsApp, limite de cupons por cliente por dia. |
| RF-2 | No menu do atendimento, a opção `camp:start` abre a campanha. Cliente sem cadastro: pede o nome, mostra o resumo das regras com o link e botões "Aceito" / "Não aceito", e depois pede a foto do cupom. |
| RF-3 | Cliente já cadastrado vê: "Cadastrar novo cupom", "Ver meus pontos", "Ver meus códigos". Com a campanha aberta, a foto ou PDF que ele enviar vale como cupom mesmo sem clicar em "Cadastrar novo cupom" antes. |
| RF-4 | "Ver meus pontos" e "Ver meus códigos" pedem que o cliente digite o número cadastrado. Se for diferente do número de quem está escrevendo, a resposta é "Você não está acessando pelo dispositivo que se cadastrou na promoção." e nada é mostrado. |
| RF-5 | A foto (ou PDF) do cupom é lida por IA com esquema fixo: CNPJ do emissor, número do cupom, chave de acesso, data e hora, valor total, se é fiscal. |
| RF-6 | Cupom repetido é recusado na hora quando bate em qualquer um: mesmo arquivo (`sha256`), mesma chave de acesso, ou mesma impressão digital dos dados (CNPJ + número + data/hora + total). Vale entre clientes diferentes. |
| RF-7 | Números = `floor((sobra + total) / valorPorNumero)`. A sobra fica guardada no cadastro do cliente e soma no próximo cupom. |
| RF-8 | Cada número da sorte é um código único na campanha e gera 1 star no extrato do STAR FRIENDS (fonte `CAMPAIGN_RECEIPT`), quando o programa está ativo. |
| RF-9 | Leitura duvidosa (sem número e sem chave, confiança baixa, CNPJ ilegível) é aceita e marcada com alerta, para a varredura. |
| RF-10 | A varredura trata como a mesma compra dois cupons aceitos com o mesmo número de cupom, ou com o mesmo emissor, dia e total (a hora só separa os dois quando foi lida em ambos e difere em mais de 2 minutos; números de cupom diferentes lidos em ambos provam compras distintas). Mantém o mais antigo e anula os números dos demais, com registro de auditoria. |
| RF-11 | O sorteio só roda depois de uma varredura feita após o último cupom, escolhe entre números válidos e grava ganhador e semente. |
| RF-12 | O menu do atendimento responde por código, sem IA, às opções `info:ofertas` (stories do Instagram cadastrado), `info:instagram` (perfil) e `info:endereco` (endereço da empresa com link do mapa). |
| RF-13 | A mídia recebida pelo WhatsApp oficial passa a guardar `sha256`, tamanho e `mediaId` em `Message.metadata`. |
| RF-15 | Cupom que a leitura não resolveu (é um cupom, mas o valor total não foi lido; ou a leitura por IA está indisponível) fica **em conferência** em vez de ser recusado. O cliente é avisado na hora de que o cupom foi recebido. Na aba "Campanha", quem tem a permissão de "Aprovar" vê a foto, informa o valor total (data e número são opcionais) e aprova, ou recusa com motivo. A aprovação segue as mesmas regras do cupom aceito na hora: período, repetição e cálculo dos números. O cliente é avisado do resultado na conversa quando a janela de 24 h está aberta. |
| RF-14 | A aba "Campanha" do STAR FRIENDS lista participantes, cupons (com a foto e o alerta) e números, exporta CSV, e tem os botões de varredura e de sorteio. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhuma chamada de IA decide regra: a IA só lê o cupom; o cálculo, o bloqueio e as respostas são código. |
| RNF-2 | O registro do cupom é uma transação só com escritas (regra 18); mensagens ao cliente saem depois do commit. |
| RNF-3 | Dois envios simultâneos do mesmo cupom resultam em um aceito e um recusado (índices únicos). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um cliente sem sobra, quando envia cupom de R$ 150 e depois um de R$ 60, então recebe 1 número no primeiro, 1 no segundo e fica com R$ 10 de sobra.
- [ ] **CA-2** — Dado um cupom já aceito, quando o mesmo arquivo é enviado de novo (por qualquer cliente), então é recusado como repetido e nenhum número é criado.
- [ ] **CA-3** — Dado um cupom aceito do cliente A, quando o cliente B envia outra foto com a mesma chave de acesso, então é recusado.
- [ ] **CA-4** — Dado dois cupons aceitos sem chave e sem número, com o mesmo CNPJ, data/hora e total, quando a varredura roda, então o mais novo fica anulado e seus números viram `VOIDED`.
- [ ] **CA-5** — Dado um cliente cadastrado, quando digita um número diferente do que está usando, então recebe a mensagem de dispositivo e nenhum dado.
- [ ] **CA-6** — Dado dois clientes cadastrados, quando A pede "meus códigos", então a resposta contém só códigos de A.
- [ ] **CA-7** — Dado um cupom de CNPJ fora da lista ou com data fora do período, quando é enviado, então é recusado com o motivo.
- [ ] **CA-8** — Dado um cupom novo depois da última varredura, quando se tenta sortear, então o sorteio é recusado pedindo nova varredura.
- [ ] **CA-9** — Dado o cliente que recusa as regras, quando clica "Não aceito", então não é cadastrado e nenhum cupom é pedido.
- [ ] **CA-11** — Dado um cupom cujo valor total não foi lido, quando é enviado, então fica em conferência, o cliente recebe a confirmação de recebimento e nenhum número é criado.
- [ ] **CA-12** — Dado um cupom em conferência, quando é aprovado com R$ 250 por um cliente com R$ 8,33 de sobra, então rende 2 números, a sobra vai a R$ 58,33 e o sorteio volta a exigir varredura.
- [ ] **CA-13** — Dado um cupom em conferência, quando é aprovado com o mesmo número, data e valor de outro cupom da campanha, então a aprovação é recusada como repetido.
- [ ] **CA-14** — Dado um cupom em conferência, quando se tenta sortear, então o sorteio é recusado até todos serem aprovados ou recusados.
- [ ] **CA-10** — Dado o limite diário de cupons aceitos atingido, quando o cliente envia mais um, então é recusado sem leitura por IA. Cupom recusado ou repetido não conta no limite; um teto de 4 tentativas por cupom permitido protege o gasto com leitura.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Reentrega do webhook da Meta para a mesma mensagem | Cupom é único por `messageId`; a segunda vez não cria nada. Se nenhuma resposta saiu depois da mensagem do cliente (o envio falhou e a etapa foi refeita), a resposta é refeita a partir do cupom gravado. |
| CB-2 | Cliente manda texto em vez de foto quando o cupom é esperado | Pede a foto de novo; "menu" ou "cancelar" saem do passo. |
| CB-3 | Foto ilegível (sem valor total) | Se a imagem é um cupom, fica em conferência (RF-15) e conta no limite do dia. Se não é um cupom, recusa e pede outra foto. |
| CB-4 | Download da mídia falhou (mensagem sem arquivo) | Pede para reenviar. |
| CB-5 | Sem chave de IA ou IA fora do ar | O cupom fica em conferência (RF-15), com o motivo "Leitura automática indisponível". |
| CB-6 | Cupom abaixo do valor por número | Aceito, 0 números, valor vai para a sobra. |
| CB-7 | Mesmo telefone em dois funis | Um participante só (`LoyaltyMember` é por telefone na empresa). |
| CB-8 | Número digitado com ou sem 55, com ou sem o nono dígito | Comparação tolera as duas variações. |
| CB-9 | Campanha encerrada ou fora do período | Informa que a promoção não está ativa. |
| CB-10 | Colisão de código da sorte | Gera outro código e tenta de novo. |
| CB-11 | Programa STAR FRIENDS desligado | Campanha funciona; só não gera stars. |
| CB-12 | Empresa sem Instagram ou sem endereço cadastrado | A opção responde que a informação não está disponível e oferece o menu. |
| CB-13 | Cliente manda várias fotos de cupom em sequência | O atendimento só roda para a última mensagem; as fotos enviadas antes dela, depois do pedido do cupom, são cadastradas na mesma rodada, na ordem de chegada (até 10), com uma resposta por cupom. |
| CB-14 | Data do cupom lida fora do formato (com segundos, sem hora) | É interpretada no horário de Brasília; se não der, conta como não lida e o cupom entra com alerta. |
| CB-16 | Participante manda foto que não é cupom (figurinha fica de fora) | É lida como cupom e recusada por não ter valor; conta como tentativa do dia. |
| CB-17 | A IA lê o ano da compra errado (2026 vira 2023) | Se o mesmo dia e hora, no ano da campanha, cai dentro do período, a data é corrigida e o cupom entra com o alerta “Ano da compra lido fora do período”. Dia e mês fora do período continuam reprovando (CA-7). |
| CB-18 | A IA troca ou engole um dígito do CNPJ ou da chave de acesso | CNPJ e chave só valem quando o dígito verificador confere; senão contam como não lidos e o cupom entra com alerta, em vez de ser recusado como de outra loja. CNPJ de outra loja confere e continua reprovando (CA-7). |
| CB-19 | Participante manda, sem ninguém pedir, uma foto que não é cupom | A tentativa é registrada como recusada e a mensagem segue para o atendimento de sempre, sem resposta da campanha. |
| CB-20 | Cupom em conferência recusado | O arquivo deixa de travar: o cliente pode reenviar a mesma foto. |
| CB-21 | Dois cliques em "Aprovar" | Só o primeiro aprova; o segundo recebe "Este cupom já foi conferido". |
| CB-15 | Cupom que rende mais de 60 números | A resposta mostra 60 e indica "Ver meus códigos" (a Meta corta a mensagem com botões em 1024 caracteres). |

## 6. Decisões de design

### D-1 — Regras fixas no código, não em fluxo editável

- **Escolha**: handler determinístico no atendimento (`campaign-handler.ts`), acionado por ids `camp:*`.
- **Alternativas descartadas**: quadros em Gatilhos Automáticos. Exigiria ligar em produção `WORKFLOW_META_INTERACTIVE` e `WORKFLOW_FORM_CHAT`, criar quadros novos, e qualquer edição do fluxo poderia abrir brecha de fraude.
- **Consequência**: a campanha não aparece no editor de fluxos; ajustes de regra são de código ou da tela da campanha.

### D-2 — Identidade é o número que a Meta entrega

- **Escolha**: todo dado é buscado pelo participante resolvido a partir do lead da conversa. O número digitado só é comparado; nunca vira chave de consulta.
- **Alternativas descartadas**: consultar pelo número digitado com código de confirmação. Abre enumeração de participantes.
- **Consequência**: quem trocou de número não vê os dados antigos pelo WhatsApp; a equipe consulta na tela.

### D-3 — Campanha dentro do STAR FRIENDS

- **Escolha**: modelos `LoyaltyCampaign*` ligados a `LoyaltyMember`; cada número rende 1 star.
- **Alternativas descartadas**: app separado de sorteio (sem reaproveitar participante, permissões e extrato).

### D-4 — Cupom duvidoso é aceito; varredura antes do sorteio

- **Escolha** (do Weydson): aceitar na hora e remover duplicados numa varredura obrigatória antes do sorteio.
- **Alternativas descartadas**: fila de conferência humana (trabalho diário para a equipe) e recusa na hora (frustra cupom legítimo).
- **Consequência**: um número entregue pode ser anulado depois; o regulamento precisa dizer isso.
- **Revisão (2026-10-13, João Gabriel)**: a fila de conferência volta, restrita ao cupom que a leitura não resolveu. No teste real com o número oficial, a leitura por IA errou campos de um cupom legítimo em três envios seguidos; sem a conferência o cliente ficava preso em "mande outra foto". Cupom lido e aceito continua sem conferência prévia.

### D-5 — Sem hash perceptual da imagem

- **Escolha**: unicidade por `sha256` do arquivo + dados lidos do cupom.
- **Alternativas descartadas**: hash perceptual (exigiria `sharp` como dependência nativa nova). Foto refeita do mesmo cupom gera os mesmos dados lidos, que já são barrados.

### D-6 — Estado da conversa na mensagem enviada

- **Escolha**: a mensagem que faz a pergunta leva `metadata.campaignAwaiting = { step, campaignId, expiresAt }`. A resposta seguinte do cliente é da campanha enquanto não vencer (30 min).
- **Alternativas descartadas**: tabela de sessão nova. O mesmo padrão já existe em `awaitingStepReply` (spec 0099).

## 7. Segurança de dados

- Nenhuma rota pública devolve cupom, pontos ou números. O regulamento público é uma página do Pages, só texto.
- Fotos de cupom e dados de participantes só nas procedures do STAR FRIENDS, com a permissão de "Ver" do app; varredura e sorteio exigem "Aprovar".
- Toda consulta do WhatsApp filtra por `memberId` do lead da conversa e por `organizationId` (CA-6).
- Limite diário de cupons por cliente (padrão 5) e recusa antes de chamar a IA (CA-10) protegem o saldo de Stars da empresa.
- O número digitado nunca é ecoado de volta nem usado em consulta (CA-5).

## 8. Regras da Meta

- Todas as mensagens são respostas dentro da janela de 24 h aberta pelo cliente; nenhuma mensagem ativa é enviada.
- Botões: até 3 opções com título de até 20 caracteres; lista: até 10 linhas de até 24 caracteres.
- O aceite das regras é opt-in só para a campanha; não autoriza disparo de marketing.
- Divulgar o ganhador fora da janela exige template de utilidade aprovado (fora do escopo).

## 9. Impacto

- [x] Schema / migration (`prisma/schema.prisma`): 4 modelos, 2 enums, 1 valor novo em `LoyaltyLedgerSource`. Aditiva. Segunda migration (`20261013200000_star_friends_receipt_review`): valor `PENDING_REVIEW` em `LoyaltyReceiptStatus`.
- [x] Procedures oRPC: `starFriends.campaign.*`.
- [ ] Realtime
- [ ] Automações (Inngest): nenhuma função nova; o handler roda dentro do agente existente.
- [ ] Env vars novas
- [ ] Breaking change
- [x] Documentação: `docs/star-friends.md`, `docs/whatsapp-oficial-overview.md` (regra 14), guia do Astro (regra 21).

## 10. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 a CA-4, CA-7, CA-8, CA-10 | automatizado | `scripts/star-friends-campaign-check.ts` (regras puras e banco local) |
| CA-11 a CA-14 | manual | teste no servidor contra o banco local (aprovar, repetir, recusar, sortear com pendência) e aba "Campanha" na tela |
| CA-5, CA-6, CA-9 | automatizado + manual | script para a comparação de número; conversa real no número de teste |
| RF-12, RF-13 | manual | mensagem real no WhatsApp oficial de teste |

## 11. Riscos e rollback

- Migration só cria tabelas e acrescenta um valor de enum: reversível apagando as tabelas; o valor de enum fica (inofensivo).
- Sem campanha ativa, o handler não faz nada: o atendimento segue como antes.
- Leitura errada do valor pela IA dá números a mais ou a menos: a foto fica guardada e a tela mostra o valor lido para conferência antes do sorteio.

### Pendências conhecidas

| # | Pendência | Estado atual | Proposta |
| --- | --- | --- | --- |
| P-1 | CNPJ lido que não confere no dígito verificador, em campanha com CNPJ cadastrado | Conta como não lido e o cupom é **aceito com o alerta** "CNPJ do emissor não foi lido" (CB-18). Salva o cupom legítimo mal lido, mas deixa passar um cupom com CNPJ parecido: em 2026-10-13 um cupom de R$ 110,18 com CNPJ lido 23198152000145 entrou assim, depois de ter sido recusado quatro vezes em produção como "de outro estabelecimento". Decisão de João Gabriel em 2026-10-13: deixar passar por enquanto. | Mandar para a conferência manual (RF-15) em vez de aceitar com alerta. Antes do sorteio, conferir o filtro "Com alerta". |
| P-2 | Stars não são estornadas quando a varredura anula números | As stars ficam no saldo do cliente. | Estorno no extrato, decidindo o que fazer com saldo que já foi trocado. |
| P-3 | Mesmo número de cupom em séries (caixas) diferentes | A varredura trata como a mesma compra e anula o mais novo (RF-10). | Considerar a série ou o valor antes de anular. |
| P-4 | Nome, aceite e telefone dependem da última mensagem enviada (D-6) | Uma mensagem de atendente no meio do cadastro faz o cliente recomeçar. | Sessão explícita no banco. |

## 12. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-13 | Weydson | Criada |
| 2026-10-13 | Weydson | RF-10: a varredura deixou de exigir o mesmo minuto. No teste real a IA leu a hora em um cupom e não leu no outro, e o repetido passou. |
| 2026-10-13 | João Gabriel | Correções após o merge: limite diário e data do formulário passam a usar o dia de Brasília (o servidor roda em UTC); data do cupom com segundos deixa de ser descartada; a varredura ignora zeros à esquerda no número do cupom; CB-13 a CB-15. |
| 2026-10-13 | João Gabriel | Menos atrito para o cliente: foto de participante vale como cupom sem o clique (RF-3, CB-16); o limite diário passa a contar só cupons aceitos (CA-10); a resposta é refeita quando o envio falha (CB-1). D-6 segue valendo para nome, aceite e telefone. |
| 2026-10-13 | João Gabriel | CB-17: no teste real o `gpt-4o-mini` leu 13/10/2026 como 2023 e o cupom legítimo foi recusado. O ano errado passa a ser corrigido com alerta; a instrução de leitura informa a data de hoje e pede o ano, a hora e a chave de acesso como impressos. |
| 2026-10-13 | João Gabriel | CB-18 e modelo de leitura: no teste real a mesma foto foi lida com CNPJ 23198522000148 e recusada. CNPJ e chave passam pelo dígito verificador. Medição com a foto, duas leituras por modelo: só o gpt-4o acertou o CNPJ nas duas; gpt-4o-mini, gpt-4.1-mini e gpt-4.1 erraram. A leitura do cupom passa a usar gpt-4o na OpenAI (custo de imagem equivalente ao do mini). Nenhum modelo leu a chave de acesso de 44 dígitos. |
| 2026-10-13 | João Gabriel | RF-15 e CA-11 a CA-14: conferência manual do cupom que a leitura não resolveu, com aviso ao cliente dentro da janela de 24 h. D-4 revista. CB-3 e CB-5 mudam (conferência em vez de recusa); CB-19 a CB-21 novos. |
