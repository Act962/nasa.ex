# Piper TTS — Setup local

Voz **pt-BR Faber** (VITS open source, ~63MB) rodando num container Docker
local. Substitui o Web Speech do browser por uma síntese MUITO mais
natural — leve em CPU, gratuito, sem cobrança Stars.

## Subir

```bash
# Build + start em background. Primeiro start baixa o voice model (~60s).
docker compose up piper -d

# Acompanhar o boot (esperar "Application startup complete")
docker compose logs -f piper
```

## Habilitar no app

Adiciona em `.env.local`:

```env
NEXT_PUBLIC_PIPER_ENABLED=true
```

Reinicia `pnpm dev`. O TTS do Astro vai tentar Piper primeiro; se o container
estiver offline, faz fallback automático pro Web Speech sem alarde.

## Verificar manualmente

```bash
# Health
curl http://localhost:10200/health

# Lista voices baixadas
curl http://localhost:10200/voices

# Gerar amostra
curl -X POST http://localhost:10200/tts \
  -H 'Content-Type: application/json' \
  -d '{"text":"Olá Weydson, como posso te ajudar hoje?"}' \
  --output amostra.wav

# Tocar no Mac
afplay amostra.wav
```

## Parar

```bash
docker compose stop piper
# Ou apaga tudo (mantém o volume com o voice model em cache)
docker compose rm -s -f piper
```

## Trocar a voz

Outras vozes pt-BR/pt-PT em <https://huggingface.co/rhasspy/piper-voices/tree/main/pt>.

1. Adicionar comando de download no `entrypoint.sh` (espelhar o bloco do
   `pt_BR-faber-medium`).
2. `docker compose build piper && docker compose up piper -d`.
3. No payload do TTS, passar `"voice": "<nome-da-voz-sem-extensao>"`.

## Troubleshooting

| Sintoma | Provável causa | Conserto |
|---|---|---|
| `docker compose up piper` trava em "downloading" | Rede lenta — Faber tem 63MB | Aguarde — o volume é cache, próximo start não baixa de novo |
| `/api/astro/tts` retorna 503 | Container down ou ainda subindo | `docker compose logs piper` pra ver o status |
| Astro fala mas com voz Web Speech | `NEXT_PUBLIC_PIPER_ENABLED` não é "true" OU Piper offline | Confere env + `docker compose ps piper` |
| Latência alta (>3s) | CPU saturada / texto longo | Diminuir `length_scale` no payload OU upgrade host |
| Voz robotizada / cortada | Texto com muitos hifens/símbolos | Veja `humanizeForSpeech` em `tts.ts` — preprocessor já trata |

## Produção

Em produção, esse container roda no mesmo VM/host do NASA OU num servidor
TTS dedicado. Setar `PIPER_HTTP_URL` no env do Next.js (não-public) apontando
pro endpoint interno; o `/api/astro/tts` faz proxy server-to-server.
