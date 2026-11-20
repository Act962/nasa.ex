---
id: 0141
titulo: Enviar áudio no bloco Enviar mensagem do FlowAstro
dominio: workflows
status: implementada
autor: João Gabriel
criada: 2026-11-13
atualizada: 2026-11-13
branch: claude/fluxo-atendimento-creator-ac11e1
pr:
peso: leve
---

# 0141 — Enviar áudio no bloco Enviar mensagem do FlowAstro

## 1. Contexto

O bloco "Enviar mensagem" do FlowAstro ([spec 0139](0139-fluxo-de-atendimento.md)) envia texto, imagem e arquivo. Empresas
que atendem por WhatsApp costumam gravar um áudio de boas-vindas ou de explicação e mandar no lugar de um texto longo.
Hoje isso só é possível como "Arquivo", que chega ao cliente como documento, sem player.

O contrato de envio dos provedores já aceita áudio (`SendCanonicalMedia` com `mediaKind: "audio"` e `isVoice`), e a API
oficial já marca a mensagem de voz (`audio.voice=true`). Falta o bloco oferecer e o passo enviar.

## 2. Objetivo

O bloco "Enviar mensagem" ganha a aba **Áudio**: a empresa sobe um arquivo de áudio e o fluxo o envia como áudio, ou como
mensagem de voz quando o arquivo é OGG/Opus.

### Não-objetivos

- Gravar o áudio pelo navegador. O navegador grava em WebM, que a API oficial não aceita como voz; exigiria conversão no
  servidor. Fica para uma spec própria.
- Converter formatos. O arquivo sai como foi enviado.
- Áudio no editor dos Gatilhos Automáticos (o quadro antigo). Só o FlowAstro ganha a aba; o passo antigo aceita o tipo
  novo sem mudar a tela dele.

## 3. Requisitos

### Funcionais

- **RF-1**: aba "Áudio" no bloco, ao lado de Texto, Imagem e Arquivo, com upload que aceita só os formatos que a API
  oficial aceita: AAC, AMR, MP3, M4A e OGG/Opus. Até 5 MB, o mesmo limite do upload do editor.
- **RF-2**: o dado do bloco é `payload.type = "AUDIO"`, com `audioUrl` (chave no armazenamento) e `fileName`.
- **RF-3**: o passo envia pelo mesmo caminho de Imagem e Arquivo (`sendMessageExecutor` do modo clássico), com
  `mediaKind: "audio"`. Arquivo `.ogg` ou `.opus` vai com `isVoice: true`: na API oficial chega como mensagem de voz. Os
  outros formatos chegam como áudio comum, com player.
- **RF-4**: a janela de 24 horas da API oficial vale como para imagem e arquivo: fechada e sem modelo de mensagem de
  reserva, o passo falha com a mensagem de sempre.
- **RF-5**: o cartão do bloco no editor mostra "Áudio" e o nome do arquivo.

### Não-funcionais

- **RNF-1**: nenhuma migration, flag ou função nova no Inngest.
- **RNF-2**: o componente de upload compartilhado ganha o tipo `audio` sem mudar os tipos que já existem.

## 4. Critérios de aceite

- **CA-1**: subir um MP3 na aba Áudio e ligar o fluxo: o cliente recebe um áudio com player no WhatsApp.
- **CA-2**: subir um OGG/Opus: na API oficial o cliente recebe uma mensagem de voz.
- **CA-3**: o seletor de arquivo não aceita PDF nem imagem na aba Áudio.
- **CA-4**: o cartão do bloco mostra "Áudio: <nome do arquivo>".

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | `.ogg` com Vorbis (não Opus) | A API oficial pode recusar como voz; o passo falha com o erro do provedor. Raro: gravadores de celular geram Opus. |
| CB-2 | Bloco salvo como Áudio sem arquivo | O passo falha com "Áudio não escolhido", como a imagem sem arquivo. |
| CB-3 | Número não oficial (Uazapi) | Envia como áudio; a Uazapi ignora a marca de voz. |

## 9. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-13 | João Gabriel | Criada e implementada (upload; gravação pelo navegador fica de fora). Falta o teste no WhatsApp (CA-1 e CA-2). |
