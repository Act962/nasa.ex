# Piper TTS HTTP server — voz pt-BR Faber (VITS open source)
#
# Build:  docker compose build piper
# Run:    docker compose up piper -d
# Health: curl http://localhost:10200/voices
# TTS:    curl -X POST http://localhost:10200/tts \
#           -H 'Content-Type: application/json' \
#           -d '{"text":"Olá Weydson"}' \
#           --output out.wav
#
# Voz default: pt_BR-faber-medium (~63MB, baixada no primeiro start
# via piper-cli; cacheada em volume).

FROM python:3.11-slim

# deps de sistema: build-essential + curl pra download da voice
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala piper-tts (Python wrapper que usa ONNX runtime + binário Piper).
# Pinned: 1.2.0 estável em maio/2026.
RUN pip install --no-cache-dir \
    "piper-tts==1.2.0" \
    "fastapi==0.115.0" \
    "uvicorn[standard]==0.30.6"

# Diretório onde voice models ficam (mountado como volume pra cache
# sobreviver entre re-builds do container)
ENV PIPER_VOICES_DIR=/voices
RUN mkdir -p ${PIPER_VOICES_DIR}

COPY server.py /app/server.py
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 10200

# Entrypoint baixa voice se ausente + sobe FastAPI
CMD ["/app/entrypoint.sh"]
