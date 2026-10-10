"""Draws the Remembrall app icons: a glass orb with red smoke on a brass stand."""
import math, random
from PIL import Image, ImageDraw, ImageFilter

random.seed(7)
OUT = "site/icons/"

def orb_icon(size, maskable=False):
    S = size * 4  # supersample
    img = Image.new("RGBA", (S, S), (15, 13, 21, 255))
    # background glow
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    scale = 0.72 if maskable else 0.86
    R = int(S * scale / 2 * 0.86)
    cx, cy = S // 2, int(S * (0.46 if not maskable else 0.47))
    gd.ellipse([cx - R * 1.25, cy - R * 1.25, cx + R * 1.25, cy + R * 1.25], fill=(210, 58, 68, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.06))
    img.alpha_composite(glow)

    # brass stand
    d = ImageDraw.Draw(img)
    brass, brass_d, brass_l = (201, 162, 74, 255), (110, 84, 32, 255), (228, 192, 106, 255)
    by = cy + R * 0.9
    d.rectangle([cx - R * 0.16, by, cx + R * 0.16, by + R * 0.28], fill=brass_d)
    d.ellipse([cx - R * 0.75, by + R * 0.18, cx + R * 0.75, by + R * 0.42], fill=brass)
    d.ellipse([cx - R * 0.6, by + R * 0.2, cx + R * 0.6, by + R * 0.3], fill=brass_l)

    # glass body
    body = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    for i in range(R, 0, -2):
        t = i / R
        c = (int(18 + 40 * (1 - t)), int(15 + 30 * (1 - t)), int(28 + 45 * (1 - t)), 255)
        bd.ellipse([cx - i, cy - i, cx + i, cy + i], fill=c)
    # red smoke
    smoke = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(smoke)
    for _ in range(70):
        a = random.random() * math.tau
        r = random.random() * R * 0.62
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * 0.85
        s = R * (0.12 + random.random() * 0.22)
        sd.ellipse([x - s, y - s, x + s, y + s], fill=(220, 50, 62, 85))
    smoke = smoke.filter(ImageFilter.GaussianBlur(S * 0.03))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
    body.alpha_composite(smoke)
    # highlight
    hl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(hl).ellipse([cx - R * 0.62, cy - R * 0.72, cx - R * 0.02, cy - R * 0.32], fill=(255, 255, 255, 120))
    hl = hl.filter(ImageFilter.GaussianBlur(S * 0.025))
    body.alpha_composite(hl)
    img.paste(body, (0, 0), mask)
    # brass band at the base of the orb
    d = ImageDraw.Draw(img)
    d.arc([cx - R, cy - R, cx + R, cy + R], start=30, end=150, fill=brass, width=max(2, int(R * 0.07)))
    return img.resize((size, size), Image.LANCZOS)

for name, size, m in [("icon-192.png", 192, False), ("icon-512.png", 512, False),
                      ("maskable-512.png", 512, True), ("apple-touch-icon.png", 180, True),
                      ("favicon-32.png", 32, False)]:
    orb_icon(size, m).convert("RGB").save(OUT + name)
print("ok")
