---
id: 0149
titulo: Link de envio de arquivos para cliente sem conta (Nbox)
dominio: nbox
status: aprovada
autor: João Gabriel (com Claude)
criada: 2026-11-24
atualizada: 2026-11-24
branch: claude/nbox-module-expansion-9887a1
pr: 525
peso: leve
---

# 0149 — Link de envio de arquivos para cliente sem conta

## 1. Contexto

Hoje, quando a equipe precisa receber arquivos de um cliente (logo, fotos, comprovantes, vídeos brutos), o cliente manda por WhatsApp, e-mail ou WeTransfer, e alguém da equipe baixa e sobe no Nbox. O arquivo chega comprimido, se perde na conversa ou passa do limite do anexo. A spec 0148 já deu ao Nbox envio de arquivos pesados (até 5 GB, em partes) e link público para **mandar** arquivos; falta o caminho inverso: **receber** arquivos de quem não tem conta.

## 2. Objetivo

A equipe gera, numa pasta do Nbox, um link com validade (7, 15 ou 30 dias). O cliente abre o link sem login, envia arquivos e eles caem direto naquela pasta. Vencido o prazo, o link não aceita mais envio nem exclusão.

### Não-objetivos

- Conta, login ou cadastro do cliente.
- Cliente ver arquivos da equipe ou de outros clientes.
- Apagar os arquivos recebidos quando o link vence (eles são da empresa e ficam guardados).
- Limite de requisições por IP (o projeto não tem infra para isso sem estado em memória; ver Riscos).

## 3. Requisitos

### Funcionais

| Id | Requisito |
| --- | --- |
| RF-1 | Na tela do Nbox, "Pedir arquivos" cria uma pasta nova (nome dado pela equipe, ex.: nome do cliente) na pasta atual e gera o link `/enviar/<token>` com validade de 7, 15 ou 30 dias (padrão 7). Uma pasta existente também pode ganhar o link pelo menu dela. |
| RF-2 | Dentro da pasta com link, a equipe vê o link, a validade e pode: copiar, prorrogar (nova validade de 7, 15 ou 30 dias a partir de agora), encerrar já e, depois de vencido, gerar um link novo (o antigo morre). |
| RF-3 | A página pública mostra o nome da empresa, o nome da pasta e a validade; pede o nome de quem envia (opcional) e aceita vários arquivos de até 5 GB cada, com progresso. |
| RF-4 | O cliente vê e pode apagar **só os arquivos enviados pelo próprio navegador**, enquanto o link vale. Vencido, a página mostra "link encerrado" e não lista nada. |
| RF-5 | Os arquivos recebidos aparecem na pasta como qualquer outro, com "Enviado por <nome> pelo link" na descrição. |
| RF-6 | Quem criou o link recebe uma notificação no sino quando um envio termina, com a quantidade de arquivos e atalho para a pasta (no máximo uma a cada 10 minutos por link). |

### Não-funcionais

| Id | Requisito |
| --- | --- |
| RNF-1 | Nenhuma tabela nova; nenhuma função nova no Inngest (vencer é comparar data). |
| RNF-2 | Cada link aceita no máximo 20 GB e 500 arquivos no total, além do limite de 150 GB da empresa (spec 0148). |
| RNF-3 | Envio pelo link não cobra Star (o cliente não escolhe gastar o saldo da empresa; um link vazado não drena Stars). |
| RNF-4 | O navegador do cliente é identificado por um código aleatório guardado nele; o servidor guarda só o hash. |

## 4. Critérios de aceite

| Id | Critério |
| --- | --- |
| CA-1 | Sem login, `/enviar/<token>` válido mostra a pasta e aceita envio; o arquivo aparece na pasta da equipe. |
| CA-2 | Token inexistente → 404. Link vencido ou encerrado → página "link encerrado", e envio/exclusão são recusados pelo servidor. |
| CA-3 | Outro navegador com o mesmo link não vê nem apaga os arquivos do primeiro. |
| CA-4 | O cliente não consegue apagar arquivo da equipe nem de outra pasta, mesmo mandando o id. |
| CA-5 | Passar de 20 GB ou 500 arquivos no link, ou do espaço da empresa, é recusado com mensagem clara. |
| CA-6 | Pasta restrita do financeiro, pasta do sistema e transferência não podem ganhar link de envio. |
| CA-7 | Ao terminar um envio, quem criou o link recebe a notificação; dois envios seguidos em menos de 10 minutos geram uma só. |

## 5. Casos de borda

| Id | Caso | Comportamento |
| --- | --- | --- |
| CB-1 | Link vence no meio de um envio | O servidor recusa fechar o envio e apaga o objeto; o cliente vê "link encerrado". |
| CB-2 | Pasta do link é apagada pela equipe | Link deixa de existir (404). |
| CB-3 | Cliente limpa os dados do navegador | Perde a lista dos próprios arquivos; os arquivos continuam na pasta da equipe. |
| CB-4 | Quem criou o link sai da empresa | Itens continuam com ele como autor (coluna obrigatória); notificação deixa de chegar. Aceito. |
| CB-5 | Envio repetido da mesma chave | Idempotente para o mesmo navegador; outro navegador recebe recusa. |

## 6. Decisões de design

### D-1 — O link é da pasta: 2 colunas em `NBoxFolder`, 1 em `NBoxItem`

- **Escolha**: `uploadToken` (único) e `uploadExpiresAt` na pasta; `uploaderTokenHash` no item, que diz que ele veio pelo link e de qual navegador.
- **Por quê**: o link não tem vida própria além da pasta e de uma data; uma tabela `NBoxUploadLink` seria uma linha por pasta. O hash por item é o que permite "cada navegador vê só o seu" sem sessão nem conta.
- **Alternativa descartada**: reaproveitar `shareToken`/`expiresAt` da transferência. Mistura dois sentidos (baixar x enviar) e o `expiresAt` apaga a pasta, o que aqui não pode acontecer.

### D-2 — Autor do item é quem criou o link

`NBoxItem.createdById` é obrigatório e aponta para `User`. O cliente não é usuário; o autor fica sendo quem criou o link, e a descrição registra o nome informado pelo cliente.

### D-3 — Sem limite por IP; travas por link

Limite por IP precisaria de estado compartilhado (Redis) que o projeto não tem; memória do processo não serve com 2 instâncias. As travas são: validade curta, 20 GB e 500 arquivos por link, espaço da empresa, encerrar a qualquer momento.

## 7. Impacto

- Migration aditiva: 3 colunas nulas e 1 índice único. Sem dado de produção dependente.
- Nova página pública `/enviar/[token]` e procedures públicas em `nbox.uploadLinks.public.*`.
- Novo tipo de notificação `NBOX_FILES_RECEIVED`.

## 8. Plano de testes

Sem runner de teste no projeto (CLAUDE.md, regra 20): verificação manual no navegador e por chamadas às procedures, cobrindo CA-1 a CA-7.

## 9. Riscos e rollback

- **Link vazado**: qualquer pessoa sobe arquivo até 20 GB / 500 arquivos. Mitigação: validade curta, encerrar já, aviso no sino. Arquivo malicioso não é executado pelo app (download por link assinado).
- **Rollback**: encerrar os links (ou esconder o botão); as colunas podem ficar.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-24 | João Gabriel (com Claude) | Barra do Nbox simplificada: "Enviar" como ação principal e Pedir arquivos, Transferir, Nova pasta e Guardar link no menu ao lado (pedido do dev; a barra quebrava em tela estreita). |
| 2026-11-24 | João Gabriel (com Claude) | Criada e aprovada no chat (visibilidade só do próprio envio; prazos 7/15/30; aviso no sino). |
