---
id: 0080
titulo: Demanda pelo Astro com descrição, e imagem como anexo e capa pelo WhatsApp
dominio: astro-bot
status: implementada
autor: Weydson
criada: 2026-10-09
atualizada: 2026-10-09
branch: feature/W-astro-correcoes-e-novas-funcionalidades-20261009
pr:
peso: completa
---

# 0080 — Demanda pelo Astro com descrição, e imagem como anexo e capa pelo WhatsApp

## 1. Contexto

Teste real em 09/10/2026, criando demanda pelo WhatsApp:

- O Astro perguntava "O que precisa ser feito?". A resposta ("Testar as automações de tempo do ASTRO") virava o **título**. A pergunta tem cara de descrição, e a demanda não tinha onde receber os detalhes: o Astro nunca gravava a descrição.
- Imagem enviada ao número só é lida pelo Astro para o **Financeiro** (boleto, nota), e só com o Astro Financeiro ligado. Sem ele, a imagem nem chega ao Astro: cai no atendimento como mensagem de lead. Não existe "mandar uma foto e ela entrar na demanda".

O modelo `Action` já tem `description` (texto), `attachments` (lista `{ name, url, type? }`) e `coverImage` (chave do arquivo). Não há mudança de banco.

## 2. Objetivo

Criar demanda pelo Astro pede o título pelo nome e oferece um passo de descrição. Pelo WhatsApp, uma imagem enviada pela equipe pode entrar numa demanda como anexo e como capa.

### Não-objetivos

- Documento (PDF, planilha), vídeo e áudio como anexo. Só imagem nesta entrega.
- Várias imagens na mesma mensagem (álbum): cada imagem é tratada sozinha.
- Anexar imagem pelo Astro da plataforma (lá a tela da demanda já faz isso).
- Ler o conteúdo da imagem com IA para preencher a demanda.
- Remover ou trocar anexo e capa pelo Astro.

## 3. Requisitos

### Parte A — título e descrição (implementada)

| ID | Requisito |
| --- | --- |
| RF-1 | A pergunta do título passa a ser "Qual o título da demanda? Um nome curto, como "Revisar contrato"." |
| RF-2 | Depois da prioridade, o Astro pergunta "Quer descrever a demanda?", com a saída "Sem descrição". O texto respondido é gravado em `Action.description`. Vale na plataforma e no WhatsApp. |

### Parte B — imagem como anexo e capa (implementada)

| ID | Requisito |
| --- | --- |
| RF-3 | Imagem enviada ao número por um membro liberado no Astro chega ao Astro mesmo com o Astro Financeiro desligado. |
| RF-4 | Com o Astro Financeiro ligado, a legenda decide: legenda que fala de demanda/tarefa vai para o Workspace; qualquer outra, e imagem sem legenda, segue para o Financeiro como hoje. |
| RF-5 | Legenda que aponta uma demanda existente ("anexa na demanda Revisar contrato") anexa a imagem nela. Mais de uma demanda com o nome: o Astro pergunta qual, com lista. |
| RF-6 | Legenda que pede demanda nova ("cria uma demanda com essa foto: Trocar banner") segue o roteiro de criação e a imagem entra na demanda criada. |
| RF-7 | Sem legenda (e sem Financeiro), o Astro pergunta "O que faço com essa imagem?" com `Anexar a uma demanda`, `Criar demanda` e `Ignorar`. |
| RF-8 | A imagem entra como **anexo** e, se a demanda ainda não tem capa, também como **capa**. Demanda que já tem capa: o Astro pergunta `Trocar a capa` ou `Só anexar`. |
| RF-9 | A imagem é guardada no armazenamento do projeto (mesmo destino dos anexos enviados pela tela), não na Meta, cujo link expira. |
| RF-10 | Limites: até 10 MB; JPG, PNG e WebP. Fora disso o Astro recusa dizendo o motivo, sem cobrar Stars. |
| RF-11 | Anexar exige permissão de editar no Workspace, a mesma da tela. |
| RF-12 | A resposta final diz o que foi feito ("Anexei a imagem em "Revisar contrato" e defini como capa.") e traz o link da demanda. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Anexar não usa IA. Não cobra Stars além do que a criação de demanda já cobra. |
| RNF-2 | Imagem que o Astro recebeu e ninguém destinou (pergunta sem resposta, "Ignorar") é apagada do armazenamento. |

## 4. Critérios de aceite

- [ ] **CA-1** — Criar demanda pelo Astro pergunta o título pelo nome e, no fim, a descrição; o texto aparece no campo Descrição da demanda.
- [ ] **CA-2** — "Sem descrição" cria a demanda com a descrição vazia.
- [ ] **CA-3** — Imagem com a legenda "anexa na demanda Revisar contrato" aparece nos Anexos e na capa dessa demanda.
- [ ] **CA-4** — Imagem com a legenda "cria uma demanda: Trocar banner" cria a demanda com a imagem como anexo e capa.
- [ ] **CA-5** — Imagem sem legenda, com o Financeiro desligado, recebe a pergunta com as três opções; `Ignorar` não cria nem altera nada.
- [ ] **CA-6** — Imagem sem legenda, com o Financeiro ligado, continua indo para a leitura de boleto/nota.
- [ ] **CA-7** — Demanda que já tem capa: o Astro pergunta antes de trocar; `Só anexar` mantém a capa.
- [ ] **CA-8** — PDF, ou imagem de 15 MB, é recusado com o motivo.
- [ ] **CA-9** — Membro sem permissão de editar no Workspace recebe a recusa de permissão, e a imagem não é guardada.
- [ ] **CA-10** — Imagem de quem não está liberado no Astro continua caindo no atendimento, como mensagem de lead.

## 5. Abordagem

- **Entrada**: `maybeHandleBotMessage` deixa de exigir `financeEnabled` para imagem; o `router.ts` decide o destino pela legenda (RF-4) antes do stake.
- **Armazenamento**: reaproveitar o download de mídia do provider (`downloadInboundMedia`) e o upload que a tela de anexos usa. Caminho próprio, ex.: `workspace/attachments/<orgId>/<uuid>.<ext>`.
- **Ações**: nova ação `action.attach_image` (anexar a demanda existente) e campo de imagem pendente no roteiro de `action.create`. A imagem pendente fica guardada por conversa, com a mesma validade do roteiro.
- **Capa**: `Action.coverImage` recebe a chave do arquivo; `Action.attachments` recebe `{ name, url, type }`.

## 6. Decisões tomadas sem resposta do Weydson

1. **Sem legenda, com o Financeiro ligado** (RF-4): continua indo para o Financeiro, como antes. Para mudar, basta `isTaskImage` em `task-image.ts`.
2. **Uazapi**: a mesma regra vale para número não oficial. Lá a pergunta "o que faço com a imagem?" sai sem botões e a pessoa responde *anexar*, *criar* ou *ignorar*.
3. **Legenda que não diz o que fazer** ("olha isso"): tratada como imagem sem legenda — o Astro pergunta o destino.

## 9. Changelog

- 2026-10-09 — criada. Parte A implementada na mesma data, a pedido do Weydson no teste real. Parte B aguardando aprovação.
- 2026-10-09 — Parte B aprovada pelo Weydson ("pode seguir com a spec da imagem") e implementada. Arquivos: `astro-bot/lib/task-image.ts`, `storeBotTaskImage` em `inbound-media.ts`, `astro/actions/workspace/pending-image.ts`, ação `action.attach_image` (`attach-image.ts`) e consumo da imagem em `create-action.ts`. A imagem pendente fica no armazenamento, numa chave fixa por conversa (`workspace/pending/<sessão>`), com validade de 15 min; ao ser destinada é movida para `workspace/attachments/<orgId>/`. Sem destino, é apagada no "Ignorar", no aviso de inatividade e na próxima consulta depois da validade (RNF-2).
- 2026-10-09 — primeiro teste real. Achados: (1) o armazenamento local recusava a gravação e o Astro ficava mudo — agora responde que não conseguiu guardar; (2) a imagem pendente ficava em memória e se perdeu quando o servidor de desenvolvimento reiniciou entre a foto e o clique em "Criar demanda" — passou para o armazenamento; (3) a Meta reenviou o mesmo webhook e a foto foi tratada duas vezes — o handler do bot agora ignora reenvio do mesmo `wamid` por 10 min. Guardar, mover e descartar a imagem pendente foram conferidos por script contra o armazenamento. O fluxo completo com foto real segue sem confirmação.
