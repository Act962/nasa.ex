#!/usr/bin/env bash
# Garante voice model pt_BR-faber-medium em /voices.
# Idempotente — pula download se já baixou no volume.
set -euo pipefail

VOICE="pt_BR-faber-medium"
VOICE_DIR="${PIPER_VOICES_DIR:-/voices}"
MODEL_FILE="${VOICE_DIR}/${VOICE}.onnx"
CONFIG_FILE="${VOICE_DIR}/${VOICE}.onnx.json"

mkdir -p "${VOICE_DIR}"

if [[ ! -f "${MODEL_FILE}" || ! -f "${CONFIG_FILE}" ]]; then
  echo "[piper] baixando voice ${VOICE}..."
  # URLs canônicas do HuggingFace mirror oficial do Piper
  BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium"
  curl -fL "${BASE}/${VOICE}.onnx" -o "${MODEL_FILE}"
  curl -fL "${BASE}/${VOICE}.onnx.json" -o "${CONFIG_FILE}"
  echo "[piper] voice baixada: ${MODEL_FILE}"
else
  echo "[piper] voice já em cache: ${MODEL_FILE}"
fi

# Sobe servidor HTTP FastAPI
exec uvicorn server:app --host 0.0.0.0 --port 10200 --log-level info
