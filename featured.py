"""
Featured image generator — Koray Tugberk semantic image SOP.

Rules implemented:
  1. One template, one font, same component count and layout on every page
  2. Main entity centered and visible
  3. Entity appears in the image text (and in the page title/H1 — build.mjs)
  4. Two-line overlay that expresses the topic rather than explaining it
  5. Overlay text smaller than the H1, set against a darkened background
  6. Brand mark watermarked in a fixed position with readable contrast
  7. Dark gradient over the background to give the text weight
  8. 1640x840, stated at the end of the filename
  9. Mobile derivative emitted for <picture>/<source>
 10. Full-bleed, usable as the OG/Twitter card

Naming: {core-text-from-image}-1640x840.jpg
Alt text = the text on the image. Written to assets/featured/manifest.json.

    python featured.py
"""
import json, os, re
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = r"C:\Users\Georg\Downloads"
OUT = os.path.join(ROOT, "assets", "featured")
os.makedirs(OUT, exist_ok=True)

W, H = 1640, 840
MOBILE = (820, 560)

SERIF = r"C:\Windows\Fonts\georgia.ttf"
SERIF_B = r"C:\Windows\Fonts\georgiab.ttf"
SANS_B = r"C:\Windows\Fonts\arialbd.ttf"

# Three purchased backgrounds. Rotated so the template stays constant while the
# entity text changes — SOP rule 1 governs the layout, not the photograph.
BACKGROUNDS = {
    "river":     os.path.join(SRC, "Depositphotos_727109760_XL.jpg"),
    "cascade":   os.path.join(SRC, "Depositphotos_787784446_XL.jpg"),
    "woodland":  os.path.join(SRC, "Depositphotos_384113188_XL.jpg"),
}

# Vertical crop anchor per image, 0 = top of frame, 1 = bottom. The subject sits
# in a different band in each photograph, so a single anchor loses it.
ANCHOR = {"river": 0.82, "cascade": 0.30, "woodland": 0.46}

# page slug -> (background, line 1, line 2, filename stem)
# Line 1 carries the entity. Line 2 expresses the topic without explaining it.
PAGES = [
    ("index",                            "river",    "Treatment in Northern New Jersey",  "Six centers, compared",              "treatment-northern-new-jersey"),
    ("valley-spring-recovery-center",    "river",    "Valley Spring Recovery Center",     "Norwood, Bergen County",             "valley-spring-recovery-center"),
    ("bluecrest-recovery-center",        "cascade",  "BlueCrest Recovery Center",         "Woodland Park, Passaic County",      "bluecrest-recovery-center"),
    ("ikon-recovery-centers",            "woodland", "IKON Recovery Centers",             "Saddle Brook, Bergen County",        "ikon-recovery-centers"),
    ("choicepoint",                      "cascade",  "ChoicePoint",                       "Fair Lawn, Bergen County",           "choicepoint"),
    ("north-jersey-recovery-center",     "woodland", "North Jersey Recovery Center",      "Fair Lawn, Bergen County",           "north-jersey-recovery-center"),
    ("boca-recovery-center-englewood",   "river",    "Boca Recovery Center Englewood",    "Englewood, Bergen County",           "boca-recovery-center-englewood"),
    ("compare",                          "cascade",  "All Six, Side by Side",             "Licensing, levels, coverage",        "all-six-side-by-side"),
    ("how-we-review",                    "woodland", "How We Review",                     "Four dimensions, equally weighted",  "how-we-review"),
]


def cover(img, w, h, anchor=0.34):
    """Crop to fill w x h at the given vertical anchor."""
    src_r, dst_r = img.width / img.height, w / h
    if src_r > dst_r:
        nw = int(img.height * dst_r)
        left = (img.width - nw) // 2
        img = img.crop((left, 0, left + nw, img.height))
    else:
        nh = int(img.width / dst_r)
        top = int((img.height - nh) * anchor)
        img = img.crop((0, top, img.width, top + nh))
    return img.resize((w, h), Image.LANCZOS)


def scrim(img):
    """SOP 7 — dark gradient so the text carries weight. Heavier at the base."""
    grad = Image.new("L", (1, H))
    for y in range(H):
        t = y / (H - 1)
        grad.putpixel((0, y), int(255 * (0.30 + 0.52 * (t ** 1.5))))
    mask = grad.resize((W, H))
    dark = Image.new("RGB", (W, H), (10, 22, 18))
    return Image.composite(dark, img, mask.point(lambda v: int(v * 0.86)))


def draw_page(bg_key, line1, line2, stem):
    img = Image.open(BACKGROUNDS[bg_key]).convert("RGB")
    img = cover(img, W, H, ANCHOR.get(bg_key, 0.34))
    img = img.filter(ImageFilter.GaussianBlur(0.4))
    img = scrim(img)
    d = ImageDraw.Draw(img)

    # --- SOP 6: brand mark, fixed position, readable contrast
    d.ellipse([64, 60, 128, 124], fill=(31, 79, 63))
    fm = ImageFont.truetype(SANS_B, 24)
    tb = d.textbbox((0, 0), "NJ", font=fm)
    d.text((96 - (tb[2] - tb[0]) / 2, 92 - (tb[3] - tb[1]) / 2 - tb[1]), "NJ", font=fm, fill=(255, 255, 255))
    fb = ImageFont.truetype(SANS_B, 19)
    d.text((144, 82), "REHAB  ·  NORTHERN NEW JERSEY", font=fb, fill=(226, 236, 230))

    # --- SOP 2 & 4: entity centered, two lines, expresses rather than explains
    f1 = ImageFont.truetype(SERIF_B, 78)
    f2 = ImageFont.truetype(SERIF, 40)
    while d.textbbox((0, 0), line1, font=f1)[2] > W - 220:
        f1 = ImageFont.truetype(SERIF_B, f1.size - 3)
    while d.textbbox((0, 0), line2, font=f2)[2] > W - 240:
        f2 = ImageFont.truetype(SERIF, f2.size - 2)

    w1 = d.textbbox((0, 0), line1, font=f1)[2]
    w2 = d.textbbox((0, 0), line2, font=f2)[2]
    y1 = H - 268
    d.text(((W - w1) / 2, y1), line1, font=f1, fill=(247, 244, 239))

    # hairline rule between the lines — fixed component, every page
    ry = y1 + f1.size + 34
    d.line([(W / 2 - 44, ry), (W / 2 + 44, ry)], fill=(143, 185, 163), width=2)

    d.text(((W - w2) / 2, ry + 28), line2, font=f2, fill=(206, 220, 211))

    path = os.path.join(OUT, f"{stem}-1640x840.jpg")
    img.save(path, quality=86, optimize=True, progressive=True)

    m = img.resize(MOBILE, Image.LANCZOS)
    mpath = os.path.join(OUT, f"{stem}-820x560.jpg")
    m.save(mpath, quality=84, optimize=True, progressive=True)

    return os.path.basename(path), os.path.basename(mpath)


manifest = {}
for slug, bg, l1, l2, stem in PAGES:
    desktop, mobile = draw_page(bg, l1, l2, stem)
    # SOP: alt = the text on the image; title = same, expanded
    alt = f"{l1} — {l2}"
    manifest[slug] = {
        "desktop": f"assets/featured/{desktop}",
        "mobile": f"assets/featured/{mobile}",
        "alt": alt,
        "title": alt,
        "line1": l1,
        "line2": l2,
    }
    print(f"  {desktop}")

with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
print(f"\n{len(manifest)} featured images + mobile derivatives -> assets/featured/")
