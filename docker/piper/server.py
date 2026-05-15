"""
Piper TTS HTTP server — wrapper FastAPI fino sobre piper-tts.

Expõe:
  GET  /voices      → lista voices disponíveis no diretório /voices
  GET  /health      → liveness probe
  POST /tts         → recebe { text, voice?, length_scale?, noise_scale? }
                      retorna audio/wav

Cache: o piper-tts faz cache de inferência via session ONNX; cada
voice fica residente em memória após primeiro request.
"""

import os
import io
import wave
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from piper import PiperVoice

VOICES_DIR = Path(os.environ.get("PIPER_VOICES_DIR", "/voices"))
DEFAULT_VOICE = "pt_BR-faber-medium"

app = FastAPI(title="Piper TTS HTTP", version="1.0.0")

# CORS aberto pro dev local (Next.js em :3000 batendo no Piper em :10200).
# Em produção, restringir via env PIPER_ALLOWED_ORIGINS.
allowed = os.environ.get(
    "PIPER_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Cache de voices carregadas — { name: PiperVoice }
_voice_cache: dict[str, PiperVoice] = {}


def _load_voice(name: str) -> PiperVoice:
    """Carrega voice do disco (com cache em memória)."""
    if name in _voice_cache:
        return _voice_cache[name]

    onnx_path = VOICES_DIR / f"{name}.onnx"
    json_path = VOICES_DIR / f"{name}.onnx.json"
    if not onnx_path.exists() or not json_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Voice '{name}' não encontrada em {VOICES_DIR}. "
            f"Faltam arquivos: {onnx_path.name}, {json_path.name}",
        )

    voice = PiperVoice.load(str(onnx_path), config_path=str(json_path))
    _voice_cache[name] = voice
    return voice


class TtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voice: Optional[str] = Field(
        default=DEFAULT_VOICE,
        description="Nome do voice model (sem extensão)",
    )
    length_scale: Optional[float] = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="Controla o RITMO da fala. >1 = mais lento, <1 = mais rápido.",
    )
    noise_scale: Optional[float] = Field(
        default=0.667,
        ge=0.0,
        le=1.0,
        description="Variabilidade da prosódia. Maior = mais expressivo, menor = mais monotônico.",
    )
    noise_w: Optional[float] = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="Variabilidade do timing entre fonemas.",
    )


@app.get("/health")
def health():
    return {"status": "ok", "voices_dir": str(VOICES_DIR)}


@app.get("/voices")
def list_voices():
    if not VOICES_DIR.exists():
        return {"voices": []}
    voices = []
    for f in VOICES_DIR.glob("*.onnx"):
        if (VOICES_DIR / f"{f.name}.json").exists():
            voices.append(f.stem)
    return {"voices": sorted(voices)}


@app.post("/tts")
def tts(req: TtsRequest):
    voice_name = req.voice or DEFAULT_VOICE
    voice = _load_voice(voice_name)

    # Gera WAV in-memory. piper.synthesize espera um wave.Wave_write,
    # então envelopamos um BytesIO com wave.open(..., "wb").
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        voice.synthesize(
            req.text,
            wav_file,
            length_scale=req.length_scale or 1.0,
            noise_scale=req.noise_scale if req.noise_scale is not None else 0.667,
            noise_w=req.noise_w if req.noise_w is not None else 0.8,
        )
    wav_bytes = buffer.getvalue()

    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={
            "Cache-Control": "no-store",
            "X-Voice": voice_name,
        },
    )
