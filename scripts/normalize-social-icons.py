"""Ícones das redes para a marca d'água do fundo: cor original, fundo removido."""
from PIL import Image
from pathlib import Path
import numpy as np

DOWNLOADS = Path.home() / "Downloads"
OUT = Path("public/redes"); OUT.mkdir(parents=True, exist_ok=True)

ICONS = {
    "facebook": "facebook-logo-facebook-logo-transparent-facebook-icon-transparent-free-free-png.webp",
    "google": "Google__G__logo.svg.webp",
    "instagram": "instagram-logo-on-circle-style-with-transparent-background-free-png.webp",
    "whatsapp": "whatsapp-logo-whatsapp-logo-transparent-whatsapp-icon-transparent-free-free-png.webp",
}
SIZE = 256

for slug, filename in ICONS.items():
    src = DOWNLOADS / filename
    if not src.exists():
        print(f"  {slug:<11} NÃO ENCONTRADO ({filename})")
        continue

    img = Image.open(src).convert("RGBA")
    arr = np.asarray(img).astype(np.float32) / 255
    rgb, alpha = arr[..., :3], arr[..., 3].copy()

    # Remove fundo branco sólido, quando houver
    h, w = alpha.shape
    corners = [(0,0), (h-1,0), (0,w-1), (h-1,w-1)]
    opaque = [rgb[y, x] for y, x in corners if alpha[y, x] > 0.8]
    if len(opaque) >= 3:
        first = opaque[0]
        if all(np.abs(c - first).sum() < 0.16 for c in opaque):
            alpha = np.where(np.abs(rgb - first).sum(axis=2) < 0.16, 0.0, alpha)

    out = np.zeros((*alpha.shape, 4), dtype=np.uint8)
    out[..., :3] = (rgb * 255).astype(np.uint8)
    out[..., 3] = (alpha * 255).astype(np.uint8)
    result = Image.fromarray(out)

    bbox = result.getbbox()
    if bbox:
        result = result.crop(bbox)

    # Quadrado com o ícone centralizado — facilita posicionar no fundo
    side = max(result.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(result, ((side - result.width)//2, (side - result.height)//2), result)
    canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    canvas.save(OUT / f"{slug}.png", "PNG", optimize=True)
    print(f"  {slug:<11} {SIZE}x{SIZE}  {(OUT / f'{slug}.png').stat().st_size/1024:.1f}KB")
