"""
Normaliza logos para o carrossel sobre fundo escuro: remove fundo sólido,
converte para branco puro e padroniza a altura.

O tratamento é escolhido pela SATURAÇÃO, não pela luminância média. Um logo
como o Bombril (elipse vermelha + texto branco vazado) tem média clara, mas
precisa do tratamento colorido — senão o texto vazado some e vira um bloco.

O alpha é binarizado com borda suave: alpha proporcional deixaria os logos
cinza sobre o fundo escuro, em vez de branco.
"""
from PIL import Image, ImageFilter
from pathlib import Path
import numpy as np

DOWNLOADS = Path.home() / "Downloads"
OUT = Path("public/marcas")
OUT.mkdir(parents=True, exist_ok=True)

LOGOS = {
    "popkins": "POPKINS.png",
    "zanlorenzi": "LOGO ZANLORENZI.png",
    "sebrae": "LOGO SEBRAE.png",
    "r-carvalho": "47882acc61a4b6ce07a5f6f12bbaee4e_r_carvalho.png",
    "coca-cola": "Coca-Cola_logo.svg.png",
    "kobber": "logo_kobber.jpeg",
    "jbs": "logo_jbs.png",
    "jmf": "logo_jmf.jpeg",
    "bombril": "LOGO BOMBRIL.png",
    "7-cidades": "LOGO_BRANCA_7_CIDADES.png",
    "kids-zone": "logo_kids_zone.png",
    "riclan": "LOGO RICLAN.png",
}

TARGET_HEIGHT = 120
LUM_CUT = 0.82        # acima disso o pixel é "fundo claro" do desenho
SOFT = 0.10           # largura da transição, para não serrilhar
MIN_BLOB_RATIO = 3e-4 # blobs menores que isto (fração da área) são sujeira

# Overrides pontuais: a heurística geral não cobre bem alguns desenhos.
# kids-zone é letra amarela com contorno preto — só o contorno define a forma,
# então o corte fica baixo para pegar apenas o preto.
LUM_CUT_OVERRIDE = {"kids-zone": 0.34}

def load(src):
    img = Image.open(src).convert("RGBA")
    arr = np.asarray(img).astype(np.float32) / 255.0
    return arr[..., :3], arr[..., 3]

def strip_corner_background(rgb, alpha, tolerance):
    h, w = alpha.shape
    corners = [(0,0), (h-1,0), (0,w-1), (h-1,w-1)]
    opaque = [rgb[y, x] for y, x in corners if alpha[y, x] > 0.8]
    if len(opaque) < 3:
        return alpha
    first = opaque[0]
    if not all(np.abs(c - first).sum() < tolerance for c in opaque):
        return alpha
    distance = np.abs(rgb - first).sum(axis=2)
    return np.where(distance < tolerance, 0.0, alpha)

def drop_small_blobs(mask):
    """Remove pontinhos soltos (artefatos de recorte) por flood fill iterativo."""
    from collections import deque
    min_blob = max(24, int(mask.size * MIN_BLOB_RATIO))
    visited = np.zeros_like(mask, dtype=bool)
    solid = mask > 0.5
    h, w = mask.shape
    for sy in range(h):
        for sx in range(w):
            if not solid[sy, sx] or visited[sy, sx]:
                continue
            queue, blob = deque([(sy, sx)]), []
            visited[sy, sx] = True
            while queue:
                y, x = queue.popleft()
                blob.append((y, x))
                for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                    ny, nx = y+dy, x+dx
                    if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        queue.append((ny, nx))
            if len(blob) < min_blob:
                for y, x in blob:
                    mask[y, x] = 0.0
    return mask

for slug, filename in LOGOS.items():
    src = DOWNLOADS / filename
    if not src.exists():
        print(f"  {slug:<14} ARQUIVO NÃO ENCONTRADO")
        continue

    rgb, alpha = load(src)
    tolerance = 0.24 if src.suffix.lower() in (".jpg", ".jpeg") else 0.13
    alpha = strip_corner_background(rgb, alpha, tolerance)

    visible = alpha > 0.5
    if not visible.any():
        print(f"  {slug:<14} VAZIO após recorte")
        continue

    lum = (0.299*rgb[...,0] + 0.587*rgb[...,1] + 0.114*rgb[...,2])
    saturation = rgb.max(axis=2) - rgb.min(axis=2)
    is_colored = float(saturation[visible].mean()) > 0.16
    is_light_mono = (not is_colored) and float(lum[visible].mean()) >= 0.62

    if is_light_mono:
        # Já é claro: mantém a silhueta e opacifica.
        mask = np.where(alpha > 0.5, 1.0, alpha)
        mode = "claro"
    else:
        # Escuro ou colorido: o desenho é o que NÃO é claro. Binariza com
        # borda suave para virar branco puro, preservando texto vazado.
        cut = LUM_CUT_OVERRIDE.get(slug, LUM_CUT)
        mask = np.clip((cut - lum) / SOFT + 0.5, 0.0, 1.0) * alpha
        mode = "colorido" if is_colored else "escuro"

    # Piso: alpha fraco vira transparente. Sem isto sobra um véu cinza onde o
    # fundo era quase branco — o logo parece ter um retângulo atrás.
    mask = np.clip((mask - 0.38) / 0.30, 0.0, 1.0)
    mask = drop_small_blobs(mask)

    out = np.zeros((*mask.shape, 4), dtype=np.uint8)
    out[..., :3] = 255
    out[..., 3] = (mask * 255).astype(np.uint8)
    img = Image.fromarray(out, "RGBA")

    if src.suffix.lower() in (".jpg", ".jpeg"):
        img.putalpha(img.getchannel("A").filter(ImageFilter.MedianFilter(3)))

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    ratio = TARGET_HEIGHT / img.height
    img = img.resize((max(1, round(img.width*ratio)), TARGET_HEIGHT), Image.LANCZOS)
    img.save(OUT / f"{slug}.png", "PNG", optimize=True)
    print(f"  {slug:<14} {mode:<9} {img.width}x{img.height}")
