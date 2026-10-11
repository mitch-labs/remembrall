"""Builds the Remembrall launch carousel: three 1080x1350 images in the app's look."""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))

# Reuse the app-icon orb drawing at a large size (without running its save loop).
src = open(os.path.join(HERE, "..", "make_icons.py")).read().split("for name, size, m in")[0]
ns = {}
exec(src, ns)

W, H = 1080, 1350
NIGHT, PANEL, PANEL2, LINE = "#0f0d15", "#18151f", "#211d2b", "#2f2a3b"
INK, MUTED, FAINT = "#ece5d3", "#9d94a8", "#6d6578"
BRASS, BRASS_D, CRIMSON = "#c9a24a", "#8a6c2c", "#d23a44"
F = lambda name, size: ImageFont.truetype(os.path.join(FONTS, name + ".ttf"), size)
M = 96


def base():
    im = Image.new("RGB", (W, H), NIGHT)
    glow = Image.new("RGB", (W, H), NIGHT)
    d = ImageDraw.Draw(glow)
    d.ellipse([-420, -560, 760, 420], fill="#261d36")
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    return Image.blend(im, glow, 0.9)


def orb(im, cx, top, size):
    o = ns["orb_icon"](size).convert("RGBA")
    # feather the square edges so the icon's own background melts into the page
    mask = Image.new("L", (size, size), 0)
    f = int(size * 0.07)
    ImageDraw.Draw(mask).rounded_rectangle([f, f, size - f, size - f], radius=f * 2, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(f * 0.7))
    im.paste(o, (cx - size // 2, top), mask)


def wordmark(d, x, y, size, anchor="l"):
    a, b = "Remem", "brall"
    fa = F("fell-sc", size)
    wa, wb = d.textlength(a, font=fa), d.textlength(b, font=fa)
    if anchor == "m":
        x = x - (wa + wb) / 2
    d.text((x, y), a, font=fa, fill=INK)
    d.text((x + wa, y), b, font=fa, fill=BRASS)


def spaced(d, xy, s, font, fill, spacing, anchor="l"):
    x, y = xy
    widths = [d.textlength(ch, font=font) for ch in s]
    total = sum(widths) + spacing * (len(s) - 1)
    if anchor == "m":
        x -= total / 2
    for ch, w in zip(s, widths):
        d.text((x, y), ch, font=font, fill=fill)
        x += w + spacing


def wrap(d, text, font, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= width:
            cur = t
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    return lines


def block(d, x, y, text, font, fill, width, leading, anchor="l"):
    for line in wrap(d, text, font, width):
        lx = x - d.textlength(line, font=font) / 2 if anchor == "m" else x
        d.text((lx, y), line, font=font, fill=fill)
        y += leading
    return y


def footer(d, n):
    d.line([M, H - 104, W - M, H - 104], fill=LINE, width=2)
    spaced(d, (M, H - 80), "REMEMBERALLS.NETLIFY.APP", F("spectral", 22), MUTED, 4)
    d.text((W - M, H - 82), f"{n} / 3", font=F("spectral", 24), fill=FAINT, anchor="ra")


# 1 · Hook ------------------------------------------------------------------
im = base(); d = ImageDraw.Draw(im)
spaced(d, (M, 110), "FROM A WORD IN A POE STORY", F("spectral", 24), BRASS, 5)
y = block(d, M, 168, "I keep forgetting the things I fall in love with.", F("fell", 76), INK, W - 2 * M, 88)
orb(im, W // 2, y + 10, 640)
d = ImageDraw.Draw(im)
wordmark(d, W // 2, y + 690, 92, "m")
t = "For the things you meant to keep."
d.text((W // 2, y + 808), t, font=F("fell-it", 40), fill=MUTED, anchor="ma")
footer(d, 1)
im.save(os.path.join(OUT, "remembrall-post-1.png"))

# 2 · The daily recall ------------------------------------------------------
im = base(); d = ImageDraw.Draw(im)
spaced(d, (M, 110), "EVERY DAY, AT THE HOUR YOU PICK", F("spectral", 24), BRASS, 5)
block(d, M, 168, "Three things you saved come back to you.", F("fell", 76), INK, W - 2 * M, 88)
# notification card
x0, y0, x1 = M, 470, W - M
card_h = 600
d.rounded_rectangle([x0, y0, x1, y0 + card_h], radius=36, fill=PANEL2, outline=LINE, width=2)
ic = ns["orb_icon"](84).convert("RGB")
cm = Image.new("L", (84, 84), 0); ImageDraw.Draw(cm).rounded_rectangle([0, 0, 83, 83], radius=20, fill=255)
im.paste(ic, (x0 + 40, y0 + 40), cm)
d = ImageDraw.Draw(im)
spaced(d, (x0 + 146, y0 + 46), "REMEMBRALL", F("spectral", 22), MUTED, 4)
d.text((x1 - 40, y0 + 44), "8:00 AM", font=F("spectral", 24), fill=FAINT, anchor="ra")
d.text((x0 + 146, y0 + 82), "You've forgotten something", font=F("spectral-md", 34), fill=INK)
rows = [("WORD OF THE DAY", "Inveterate"), ("RECIPE YOU SAVED", "Tiramisu chia seeds"),
        ("BOOK YOU SAID YOU'D READ", "The Laws of Human Nature")]
ry = y0 + 170
for i, (k, v) in enumerate(rows):
    d.line([x0 + 40, ry, x1 - 40, ry], fill=LINE, width=2)
    d.text((x0 + 44, ry + 48), f"{i + 1}.", font=F("fell", 44), fill=BRASS)
    spaced(d, (x0 + 110, ry + 34), k, F("spectral", 21), MUTED, 4)
    d.text((x0 + 110, ry + 66), v, font=F("fell", 46), fill=INK)
    ry += 140
# done tick hint
ty = y0 + card_h + 56
d.rounded_rectangle([M, ty, M + 44, ty + 44], radius=8, fill=BRASS)
d.line([M + 11, ty + 23, M + 19, ty + 32, M + 34, ty + 12], fill=NIGHT, width=6, joint="curve")
block(d, M + 70, ty - 2, "Did it? Tick it done and it leaves your reminders.", F("spectral", 34), INK, W - 2 * M - 70, 46)
footer(d, 2)
im.save(os.path.join(OUT, "remembrall-post-2.png"))

# 3 · What it holds + CTA ---------------------------------------------------
im = base(); d = ImageDraw.Draw(im)
spaced(d, (M, 110), "A SHELF FOR EVERYTHING", F("spectral", 24), BRASS, 5)
block(d, M, 168, "Reels, recipes, words, books, ideas.", F("fell", 76), INK, W - 2 * M, 88)
shelves = [("Word", "Inveterate"), ("Recipe", "Steak sinuglaw"), ("Book", "The Laws of Human Nature"),
           ("Reel", "That pasta trick"), ("Fact", "Octopuses have three hearts"), ("+ New", "Make your own")]
gw, gh, gap = (W - 2 * M - 28) // 2, 168, 24
for i, (k, v) in enumerate(shelves):
    cx = M + (i % 2) * (gw + gap); cy = 392 + (i // 2) * (gh + gap)
    new = k.startswith("+")
    d.rounded_rectangle([cx, cy, cx + gw, cy + gh], radius=16, fill=NIGHT if new else PANEL,
                        outline=BRASS_D if new else LINE, width=2)
    spaced(d, (cx + 30, cy + 30), k.upper(), F("spectral", 21), BRASS, 4)
    lines = wrap(d, v, F("fell", 38), gw - 60)[:2]
    for j, ln in enumerate(lines):
        d.text((cx + 30, cy + 66 + j * 40), ln, font=F("fell", 38), fill=MUTED if new else INK)
cy = 392 + 3 * (gh + gap) + 28
d.text((W // 2, cy), "Free on your phone and your desk.", font=F("fell-it", 44), fill=MUTED, anchor="ma")
bw = 760
d.rounded_rectangle([W // 2 - bw // 2, cy + 82, W // 2 + bw // 2, cy + 182], radius=12, fill=BRASS)
d.text((W // 2, cy + 132), "rememberalls.netlify.app", font=F("fell", 50), fill="#1a1408", anchor="mm")
footer(d, 3)
im.save(os.path.join(OUT, "remembrall-post-3.png"))
print("ok")
