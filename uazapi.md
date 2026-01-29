# Documentação Uazapi

## Enpoinst normais

### Enviar mensagem de texto

const url = 'https://free.uazapi.com/send/text';
const options = {
method: 'POST',
headers: {
Accept: 'application/json',
token: '121212',
'Content-Type': 'application/json'
},
body: '{"number":"5511999999999","text":"Olá! Como posso ajudar?"}'
};

try {
const response = await fetch(url, options);
const data = await response.json();
console.log(data);
} catch (error) {
console.error(error);
}

## Obs

### Enviar mensagem de texto

Envia uma mensagem de texto para um contato ou grupo.

Recursos Específicos
Preview de links com suporte a personalização automática ou customizada
Formatação básica do texto
Substituição automática de placeholders dinâmicos
Campos Comuns
Este endpoint suporta todos os campos opcionais comuns documentados na tag "Enviar Mensagem", incluindo: delay, readchat, readmessages, replyid, mentions, forward, track_source, track_id, placeholders e envio para grupos.

Preview de Links
Preview Automático
{
"number": "5511999999999",
"text": "Confira: https://exemplo.com",
"linkPreview": true
}

Fields:
Request
Body
number
string
required
ID do chat para o qual a mensagem será enviada. Pode ser um número de telefone em formato internacional, um ID de grupo (@g.us), um ID de usuário (com @s.whatsapp.net ou @lid).

Example: "5511999999999"

text
string
required
Texto da mensagem (aceita placeholders)

Example: "Olá {{name}}! Como posso ajudar?"

linkPreview
boolean
Ativa/desativa preview de links. Se true, procura automaticamente um link no texto para gerar preview.

Comportamento:

Se apenas linkPreview=true: gera preview automático do primeiro link encontrado no texto
Se fornecidos campos personalizados (title, description, image): usa os valores fornecidos
Se campos personalizados parciais: combina com dados automáticos do link como fallback
Example: true

linkPreviewTitle
string
Define um título personalizado para o preview do link

Example: "Título Personalizado"

linkPreviewDescription
string
Define uma descrição personalizada para o preview do link

Example: "Descrição personalizada do link"

linkPreviewImage
string
URL ou Base64 da imagem para usar no preview do link

Example: "https://exemplo.com/imagem.jpg"

linkPreviewLarge
boolean
Se true, gera um preview grande com upload da imagem. Se false, gera um preview pequeno sem upload

Example: true

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
Atraso em milissegundos antes do envio, durante o atraso apacerá 'Digitando...'

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
Se true, envia a mensagem de forma assíncrona via fila interna. Útil para alto volume de mensagens.

### Response

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
    "message": "Message sent successfully"
  }
}
```
