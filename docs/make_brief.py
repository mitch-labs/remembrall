"""Builds docs/Remembrall-brief.pdf: a short 16:9 slide brief in the app's own look."""
import os, sys
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import simpleSplit, ImageReader
from reportlab.lib.colors import HexColor

FONTS = sys.argv[1]
OUT = sys.argv[2]
ICON = os.path.join(os.path.dirname(__file__), "..", "site", "icons", "icon-512.png")
for name, f in [("Fell", "fell"), ("FellIt", "fell-it"), ("FellSC", "fell-sc"),
                ("Spec", "spectral"), ("SpecIt", "spectral-it"), ("SpecMd", "spectral-md")]:
    pdfmetrics.registerFont(TTFont(name, os.path.join(FONTS, f + ".ttf")))

W, H = 960, 540
NIGHT, PANEL, PANEL2, LINE = HexColor("#0f0d15"), HexColor("#18151f"), HexColor("#211d2b"), HexColor("#2f2a3b")
INK, MUTED, FAINT = HexColor("#ece5d3"), HexColor("#9d94a8"), HexColor("#6d6578")
BRASS, BRASS_D, CRIMSON = HexColor("#c9a24a"), HexColor("#8a6c2c"), HexColor("#d23a44")
M = 64  # page margin

c = canvas.Canvas(OUT, pagesize=(W, H))
c.setTitle("Remembrall")
c.setAuthor("Remembrall")
c.setSubject("What Remembrall is and how it works")
TOTAL = 7
page_no = [0]


def text(x, y, s, font="Spec", size=16, color=INK, align="left", spacing=0):
    c.setFont(font, size); c.setFillColor(color)
    t = c.beginText(); t.setTextOrigin(x, y); t.setFont(font, size); t.setCharSpace(spacing)
    if align == "center":
        w = pdfmetrics.stringWidth(s, font, size) + spacing * (len(s) - 1)
        t.setTextOrigin(x - w / 2, y)
    elif align == "right":
        w = pdfmetrics.stringWidth(s, font, size) + spacing * (len(s) - 1)
        t.setTextOrigin(x - w, y)
    t.textOut(s); c.drawText(t)


def para(x, y, s, width, font="Spec", size=16, color=INK, leading=None):
    leading = leading or size * 1.45
    for line in simpleSplit(s, font, size, width):
        text(x, y, line, font, size, color); y -= leading
    return y


def eyebrow(x, y, s, color=BRASS):
    text(x, y, s.upper(), "Spec", 10.5, color, spacing=2.2)


def slide(eyebrow_text=None):
    if page_no[0]:
        c.showPage()
    page_no[0] += 1
    c.setFillColor(NIGHT); c.rect(0, 0, W, H, stroke=0, fill=1)
    # soft violet light from the top-left, like the app
    for i in range(18):
        a = 0.022
        c.setFillColor(HexColor("#2a2040"), alpha=a)
        r = 520 - i * 24
        c.circle(150, H + 60, r, stroke=0, fill=1)
    c.setFillAlpha(1)
    if eyebrow_text:
        eyebrow(M, H - 56, eyebrow_text)
    # footer
    c.setStrokeColor(LINE); c.setLineWidth(0.8); c.line(M, 40, W - M, 40)
    text(M, 24, "Remem", "FellSC", 11, MUTED)
    text(M + pdfmetrics.stringWidth("Remem", "FellSC", 11), 24, "brall", "FellSC", 11, BRASS)
    text(W - M, 24, f"{page_no[0]} / {TOTAL}", "Spec", 10, FAINT, "right")


def panel(x, y, w, h, fill=PANEL, stroke=LINE, r=8):
    c.setFillColor(fill); c.setStrokeColor(stroke); c.setLineWidth(0.9)
    c.roundRect(x, y, w, h, r, stroke=1, fill=1)


def orb(x, y, size):
    c.drawImage(ImageReader(ICON), x, y, size, size, mask="auto")


# 1 · Cover ---------------------------------------------------------------
slide()
orb(W - 64 - 330, 70, 330)
text(M, 318, "Remem", "FellSC", 76, INK)
text(M + pdfmetrics.stringWidth("Remem", "FellSC", 76), 318, "brall", "FellSC", 76, BRASS)
text(M + 4, 272, "For the things you meant to keep.", "FellIt", 26, MUTED)
para(M + 4, 214, "A place to drop the words, recipes, books, reels and facts you find interesting, "
     "and a glass orb that hands a few of them back to you every day.", 440, "Spec", 15.5, INK, 24)
eyebrow(M + 4, 112, "Phone and desktop  ·  rememberalls.netlify.app", MUTED)

# 2 · Where it started ------------------------------------------------------
slide("Where it started")
text(M, 404, "A word in a Poe story", "Fell", 44, INK)
para(M, 352, "Reading Edgar Allan Poe's Metzengerstein, I kept stopping at words I liked. "
     "Words like inveterate. I'd look them up, love them for a minute, and lose them by the next week.",
     400, "Spec", 16, INK, 25)
para(M, 238, "Remembrall started as a way to keep those words around, and grew to hold everything else "
     "I find interesting and then forget.", 400, "SpecIt", 16, MUTED, 25)
# dictionary card
px, py, pw, ph = 530, 150, 366, 250
panel(px, py, pw, ph, PANEL2)
c.setStrokeColor(BRASS_D); c.setLineWidth(1.4); c.line(px + 28, py + ph - 70, px + pw - 28, py + ph - 70)
eyebrow(px + 28, py + ph - 44, "Word of the day")
text(px + 28, py + ph - 116, "Inveterate", "Fell", 40, INK)
text(px + 28, py + ph - 142, "in·vet·er·ate   adjective", "SpecIt", 13, MUTED)
para(px + 28, py + ph - 180, "Having a habit or way of being so long that it is unlikely to change. "
     "An inveterate reader; an inveterate liar.", pw - 56, "Spec", 14, INK, 21)

# 3 · The problem -------------------------------------------------------------
slide("The problem")
text(M, 404, "Saved is not the same as remembered", "Fell", 40, INK)
para(M, 360, "We save things all day, and almost never look at them again. "
     "They sink under everything newer.", 560, "Spec", 16, MUTED, 24)
cards = [("Reels", "The recipe reel saved at midnight"), ("Recipes", "Steak sinuglaw, tiramisu chia seeds"),
         ("Notes", "Ideas typed into a notes app, then buried"), ("Words", "Inveterate, from a Poe story"),
         ("Books", "The one you said you'd read next"), ("Facts", "Something wonderful from a video")]
cw, chh, gap = 262, 92, 18
for i, (k, v) in enumerate(cards):
    col, row = i % 3, i // 3
    x = M + col * (cw + gap); y = 196 - row * (chh + gap)
    panel(x, y, cw, chh)
    eyebrow(x + 20, y + chh - 30, k)
    para(x + 20, y + chh - 56, v, cw - 40, "Fell", 16, INK, 20)

# 4 · How it works -------------------------------------------------------------
slide("How it works")
text(M, 404, "Drop it in. It comes back. Tick it off.", "Fell", 40, INK)
steps = [("1", "Drop it in", "Type the thing, pick a shelf, and add a line to jog your memory. "
          "Paste a link and it becomes tappable."),
         ("2", "It comes back", "Every day, at the hour you choose, Remembrall sends a notification "
          "with up to three things, each from a different shelf."),
         ("3", "Tick it off", "Made the recipe? Read the book? Tick it as done and it leaves "
          "your reminders. Untick to bring it back.")]
sw, sg = 262, 18
for i, (n, t, d) in enumerate(steps):
    x = M + i * (sw + sg); y = 96
    panel(x, y, sw, 250)
    c.setFillColor(BRASS); c.circle(x + 40, y + 206, 18, stroke=0, fill=1)
    text(x + 40, y + 200, n, "Fell", 20, NIGHT, "center")
    text(x + 24, y + 150, t, "Fell", 24, INK)
    para(x + 24, y + 118, d, sw - 48, "Spec", 14, MUTED, 21)

# 5 · The daily recall -------------------------------------------------------
slide("The daily recall")
text(M, 404, "The smoke turns red", "Fell", 44, INK)
para(M, 352, "Like the Remembrall in Harry Potter, the orb fills with red smoke when there is something "
     "you've forgotten. Tap it and today's recall clears into view.", 380, "Spec", 16, INK, 25)
para(M, 248, "The same list arrives as a notification on your phone or computer, at the hour you pick, "
     "in your own time zone.", 380, "Spec", 16, MUTED, 25)
# notification mock
nx, ny, nw, nh = 500, 132, 396, 270
panel(nx, ny, nw, nh, PANEL2, LINE, 16)
c.drawImage(ImageReader(ICON), nx + 22, ny + nh - 58, 36, 36, mask="auto")
text(nx + 70, ny + nh - 36, "REMEMBRALL", "Spec", 10, MUTED, spacing=1.6)
text(nx + nw - 22, ny + nh - 36, "8:00 AM", "Spec", 10, FAINT, "right")
text(nx + 70, ny + nh - 54, "You've forgotten something", "SpecMd", 14, INK)
rows = [("Word of the day", "Inveterate"), ("Recipe you saved", "Tiramisu chia seeds"),
        ("Book you said you'd read", "The Laws of Human Nature")]
yy = ny + nh - 100
for i, (k, v) in enumerate(rows):
    c.setStrokeColor(LINE); c.line(nx + 22, yy + 30, nx + nw - 22, yy + 30)
    text(nx + 26, yy, f"{i + 1}.", "Fell", 18, BRASS)
    eyebrow(nx + 56, yy + 8, k, MUTED)
    text(nx + 56, yy - 12, v, "Fell", 18, INK)
    yy -= 58

# 6 · The shelves --------------------------------------------------------------
slide("The shelves")
text(M, 404, "A shelf for every kind of thing", "Fell", 40, INK)
para(M, 360, "Six shelves to start, and you can add your own. Tap a shelf to see what's on it, "
     "then tap an entry to open its memory line and links.", 600, "Spec", 16, MUTED, 24)
shelves = [("Word", "Word of the day"), ("Recipe", "Recipe you saved"), ("Book", "Book you said you'd read"),
           ("News", "News you caught"), ("Fact", "Thing you learned"), ("Idea", "Thought you dropped in"),
           ("Movie", "Your own shelf"), ("+ New", "Places, quotes, songs…")]
bw, bh, bg = 191, 74, 14
for i, (k, v) in enumerate(shelves):
    col, row = i % 4, i // 4
    x = M + col * (bw + bg); y = 196 - row * (bh + bg)
    new = k.startswith("+")
    custom = k == "Movie"
    panel(x, y, bw, bh, NIGHT, BRASS_D if (new or custom) else LINE)
    if new:
        c.setDash(4, 3); c.setStrokeColor(BRASS_D); c.roundRect(x, y, bw, bh, 8, stroke=1, fill=0); c.setDash()
    text(x + 18, y + bh - 32, k, "Fell", 20, BRASS if (new or custom) else INK)
    text(x + 18, y + 18, v, "SpecIt", 12, MUTED)

# 7 · Get it --------------------------------------------------------------------
slide("Get it")
orb(W - 64 - 250, 92, 250)
text(M, 404, "On your phone and your desk", "Fell", 40, INK)
items = [("Open", "rememberalls.netlify.app and create an account. Your entries are private to you."),
         ("Install", "On iPhone: Safari, Share, Add to Home Screen. On Android or desktop: tap Install."),
         ("Turn on reminders", "Pick an hour, allow notifications, and send yourself a test.")]
y = 344
for k, v in items:
    c.setFillColor(BRASS); c.circle(M + 5, y + 5, 3.5, stroke=0, fill=1)
    text(M + 22, y, k, "Fell", 20, INK)
    y = para(M + 22, y - 26, v, 470, "Spec", 15, MUTED, 22) - 18
text(M, 104, "Free, private to you, and synced between your devices.", "FellIt", 17, BRASS)

c.save()
print("pages:", page_no[0])
