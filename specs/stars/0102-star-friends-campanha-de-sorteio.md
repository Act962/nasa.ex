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
- Conferência manual cupom a cupom antes de liberar os números (D-4).
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
| RF-3 | Cliente já cadastrado vê: "Cadastrar novo cupom", "Ver meus pontos", "Ver meus códigos". |
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
- [ ] **CA-10** — Dado o limite diário de cupons atingido, quando o cliente envia mais um, então é recusado sem leitura por IA.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Reentrega do webhook da Meta para a mesma mensagem | Cupom é único por `messageId`; a segunda vez não cria nada. |
| CB-2 | Cliente manda texto em vez de foto quando o cupom é esperado | Pede a foto de novo; "menu" ou "cancelar" saem do passo. |
| CB-3 | Foto ilegível (sem valor total) | Recusa e pede outra foto; não conta como cupom aceito. |
| CB-4 | Download da mídia falhou (mensagem sem arquivo) | Pede para reenviar. |
| CB-5 | Sem chave de IA ou IA fora do ar | Avisa que não conseguiu ler agora e pede para tentar mais tarde; nada é gravado. |
| CB-6 | Cupom abaixo do valor por número | Aceito, 0 números, valor vai para a sobra. |
| CB-7 | Mesmo telefone em dois funis | Um participante só (`LoyaltyMember` é por telefone na empresa). |
| CB-8 | Número digitado com ou sem 55, com ou sem o nono dígito | Comparação tolera as duas variações. |
| CB-9 | Campanha encerrada ou fora do período | Informa que a promoção não está ativa. |
| CB-10 | Colisão de código da sorte | Gera outro código e tenta de novo. |
| CB-11 | Programa STAR FRIENDS desligado | Campanha funciona; só não gera stars. |
| CB-12 | Empresa sem Instagram ou sem endereço cadastrado | A opção responde que a informação não está disponível e oferece o menu. |

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

- [x] Schema / migration (`prisma/schema.prisma`): 4 modelos, 2 enums, 1 valor novo em `LoyaltyLedgerSource`. Aditiva.
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
| CA-5, CA-6, CA-9 | automatizado + manual | script para a comparação de número; conversa real no número de teste |
| RF-12, RF-13 | manual | mensagem real no WhatsApp oficial de teste |

## 11. Riscos e rollback

- Migration só cria tabelas e acrescenta um valor de enum: reversível apagando as tabelas; o valor de enum fica (inofensivo).
- Sem campanha ativa, o handler não faz nada: o atendimento segue como antes.
- Leitura errada do valor pela IA dá números a mais ou a menos: a foto fica guardada e a tela mostra o valor lido para conferência antes do sorteio.

## 12. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-13 | Weydson | Criada |
| 2026-10-13 | Weydson | RF-10: a varredura deixou de exigir o mesmo minuto. No teste real a IA leu a hora em um cupom e não leu no outro, e o repetido passou. |
