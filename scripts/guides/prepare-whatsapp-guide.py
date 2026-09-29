#!/usr/bin/env python3
"""Prepara os prints do guia "Conectar WhatsApp Oficial" (spec 0040).

Lê src/features/campanhas/lib/whatsapp-connect-guide.json, pega o print de
origem de cada passo (campo "source", nome do arquivo enviado pela equipe),
pixeliza os dados pessoais (foto, nome, e-mail, portfólios de clientes),
escreve rótulos neutros e grava em public/guides/whatsapp-oficial/NN-slug.webp.

Uso:
  python3 scripts/guides/prepare-whatsapp-guide.py <pasta-dos-prints> [--preview <pasta>]

--preview grava cópias com o alvo da seta desenhado, só para conferência.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
GUIDE_PATH = ROOT / "src/features/campanhas/lib/whatsapp-connect-guide.json"
OUTPUT_DIR = ROOT / "public/guides/whatsapp-oficial"
MAX_WIDTH = 1600
PIXEL_BLOCK = 16


def cover_with_avatar(image: Image.Image, box: list) -> None:
    left, top, right, bottom = box[:4]
    draw = ImageDraw.Draw(image)
    draw.rectangle((left, top, right, bottom), fill="#f0f2f5")
    size = min(right - left, bottom - top) - 4
    cx, cy = (left + right) // 2, (top + bottom) // 2
    draw.ellipse((cx - size // 2, cy - size // 2, cx + size // 2, cy + size // 2), fill="#bcc0c4")


def pixelate(image: Image.Image, box: list) -> None:
    left, top, right, bottom = box[:4]
    region = image.crop((left, top, right, bottom))
    small = region.resize((max(1, (right - left) // PIXEL_BLOCK), max(1, (bottom - top) // PIXEL_BLOCK)), Image.NEAREST)
    image.paste(small.resize(region.size, Image.NEAREST), (left, top))


def load_font(size: int) -> ImageFont.ImageFont:
    for candidate in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf"):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def prepare_step(step: dict, source_dir: Path, preview_dir: Path | None) -> Path | None:
    shot = step.get("shot")
    if not shot:
        return None
    if not step.get("source"):
        return None
    source = source_dir / step["source"]
    if not source.exists():
        print(f"  ! passo {step['n']}: print {source.name} não encontrado")
        return None
    image = Image.open(source).convert("RGB")
    if image.size != (shot["w"], shot["h"]):
        print(f"  ! passo {step['n']}: tamanho {image.size} difere do JSON {(shot['w'], shot['h'])}")
    for box in step.get("redact", []):
        if len(box) > 4 and box[4] == "avatar":
            cover_with_avatar(image, box)
        else:
            pixelate(image, box)
    draw = ImageDraw.Draw(image)
    for label in step.get("labels", []):
        draw.rectangle((label["x"] - 4, label["y"] - 4, label["x"] + 190, label["y"] + 20), fill="white")
        draw.text((label["x"], label["y"]), label["text"], fill="#1c1e21", font=load_font(15))
    crop = shot.get("crop")
    if crop:
        image = image.crop(tuple(crop))
    if image.width > MAX_WIDTH:
        image = image.resize((MAX_WIDTH, round(image.height * MAX_WIDTH / image.width)), Image.LANCZOS)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUTPUT_DIR / f"{step['n']:02d}-{step['slug']}.webp"
    image.save(output, "WEBP", quality=82)
    if preview_dir:
        preview = image.copy()
        left, top, right, bottom = shot["target"]
        offset_x, offset_y = (crop[0], crop[1]) if crop else (0, 0)
        ImageDraw.Draw(preview).rectangle((left - offset_x, top - offset_y, right - offset_x, bottom - offset_y), outline="red", width=4)
        preview_dir.mkdir(parents=True, exist_ok=True)
        preview.save(preview_dir / f"{step['n']:02d}.png")
    return output


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    source_dir = Path(sys.argv[1])
    preview_dir = Path(sys.argv[sys.argv.index("--preview") + 1]) if "--preview" in sys.argv else None
    guide = json.loads(GUIDE_PATH.read_text())
    for stale in OUTPUT_DIR.glob("*.webp"):
        stale.unlink()
    for step in guide["steps"]:
        output = prepare_step(step, source_dir, preview_dir)
        if output:
            print(f"  ✓ passo {step['n']:2d} → {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
