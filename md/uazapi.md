# Documentação Uazapi

## Enpoinst normais

### Enviar mídia (imagem, vídeo, áudio ou documento)

Envia diferentes tipos de mídia para um contato ou grupo. Suporta URLs ou arquivos base64.

Tipos de Mídia Suportados

- image: Imagens (JPG preferencialmente)
- video: Vídeos (apenas MP4)
- document: Documentos (PDF, DOCX, XLSX, etc)
- audio: Áudio comum (MP3 ou OGG)
- myaudio: Mensagem de voz (alternativa ao PTT)
- ptt: Mensagem de voz (Push-to-Talk)
- ptv: Mensagem de vídeo (Push-to-Video)
- sticker: Figurinha/Sticker

## Recursos Específicos

- Upload por URL ou base64
- Caption/legenda opcional com suporte a placeholders
- Nome personalizado para documentos (docName)
- Geração automática de thumbnails
- Compressão otimizada conforme o tipo

## Campos Comuns

Este endpoint suporta todos os campos opcionais comuns documentados na tag "Enviar Mensagem", incluindo: delay, readchat, readmessages, replyid, mentions, forward, track_source, track_id, placeholders e envio para grupos.

## Exemplos Básicos

### Imagem Simples

```json
{
  "number": "5511999999999",
  "type": "image",
  "file": "https://exemplo.com/foto.jpg"
}
```

```json
{
  "number": "5511999999999",
  "type": "document",
  "file": "https://exemplo.com/contrato.pdf",
  "docName": "Contrato.pdf",
  "text": "Segue o documento solicitado"
}
```

### Request

## Body

number
string
required
ID do chat para o qual a mensagem será enviada. Pode ser um número de telefone em formato internacional, um ID de grupo (@g.us), um ID de usuário (com @s.whatsapp.net ou @lid).

Example: "5511999999999"

type
string
required
Tipo de mídia (image, video, document, audio, myaudio, ptt, ptv, sticker)

Valores possíveis: image, video, document, audio, myaudio, ptt, ptv, sticker
Example: "image"

file
string
required
URL ou base64 do arquivo

Example: "https://exemplo.com/imagem.jpg"

text
string
Texto descritivo (caption) - aceita placeholders

Example: "Veja esta foto!"

docName
string
Nome do arquivo (apenas para documents)

Example: "relatorio.pdf"

thumbnail
string
URL ou base64 de thumbnail personalizado para vídeos e documentos

Example: "https://exemplo.com/thumb.jpg"

mimetype
string
MIME type do arquivo (opcional, detectado automaticamente)

Example: "application/pdf"

replyid
string
ID da mensagem para responder

Example: "3EB0538DA65A59F6D8A251"

mentions
string
Números para mencionar (separados por vírgula)

Example: "5511999999999,5511888888888"

readchat
boolean
Marca conversa como lida após envio

Example: true

readmessages
boolean
Marca últimas mensagens recebidas como lidas

Example: true

delay
integer
Atraso em milissegundos antes do envio, durante o atraso apacerá 'Digitando...' ou 'Gravando áudio...'

Example: 1000

forward
boolean
Marca a mensagem como encaminhada no WhatsApp

Example: true

track_source
string
Origem do rastreamento da mensagem

Example: "chatwoot"

track_id
string
ID para rastreamento da mensagem (aceita valores duplicados)

Example: "msg_123456789"

async
boolean
Se true, envia a mensagem de forma assíncrona via fila interna

## Response

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "messageid": "string",
  "chatid": "string",
  "sender": "string",
  "senderName": "string",
  "isGroup": false,
  "fromMe": false,
  "messageType": "string",
  "source": "string",
  "messageTimestamp": 0,
  "status": "string",
  "text": "string",
  "quoted": "string",
  "edited": "string",
  "reaction": "string",
  "vote": "string",
  "convertOptions": "string",
  "buttonOrListid": "string",
  "owner": "string",
  "error": "string",
  "content": null,
  "wasSentByApi": false,
  "sendFunction": "string",
  "sendPayload": null,
  "fileURL": "string",
  "send_folder_id": "string",
  "track_source": "string",
  "track_id": "string",
  "ai_metadata": {
    "agent_id": "string",
    "request": {
      "messages": ["item"],
      "tools": ["item"],
      "options": {
        "model": "string",
        "temperature": 0,
        "maxTokens": 0,
        "topP": 0,
        "frequencyPenalty": 0,
        "presencePenalty": 0
      }
    },
    "response": {
      "choices": ["item"],
      "toolResults": ["item"],
      "error": "string"
    }
  },
  "sender_pn": "string",
  "sender_lid": "string",
  "response": {
    "status": "success",
    "message": "Media sent successfully",
    "fileUrl": "https://mmg.whatsapp.net/..."
  }
}
```
