from pathlib import Path
from random import Random
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "web" / "public" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

INK = "#171716"
CREAM = "#fff4d6"
AMBER = "#ffc43d"
TEAL = "#54e0b5"
CYAN = "#63c7e6"
MAGENTA = "#c53db4"


def image(size, color=(0, 0, 0, 0)):
    return Image.new("RGBA", size, color)


def save(img, name):
    img.save(OUT / name, optimize=True)


def avatar(name, fur, belly, ear="cat", accessory=None):
    img = image((32, 32))
    d = ImageDraw.Draw(img)
    if ear == "cat":
        d.polygon([(5, 10), (5, 2), (12, 7), (20, 7), (27, 2), (27, 12)], fill=INK)
        d.polygon([(7, 9), (7, 5), (11, 8)], fill=fur)
        d.polygon([(21, 8), (25, 5), (25, 10)], fill=fur)
    elif ear == "long":
        d.rectangle((6, 0, 11, 11), fill=INK)
        d.rectangle((20, 0, 25, 11), fill=INK)
        d.rectangle((8, 1, 9, 8), fill=belly)
        d.rectangle((22, 1, 23, 8), fill=belly)
    elif ear == "round":
        d.rectangle((4, 5, 11, 12), fill=INK)
        d.rectangle((20, 5, 27, 12), fill=INK)
        d.rectangle((6, 6, 9, 9), fill=belly)
        d.rectangle((22, 6, 25, 9), fill=belly)
    elif ear == "fin":
        d.polygon([(4, 12), (0, 7), (0, 20), (5, 18)], fill=INK)
        d.polygon([(27, 11), (31, 6), (31, 21), (27, 18)], fill=INK)
    d.rectangle((5, 8, 26, 25), fill=INK)
    d.rectangle((7, 7, 24, 23), fill=fur)
    d.rectangle((9, 18, 22, 24), fill=belly)
    d.rectangle((8, 25, 23, 28), fill=INK)
    d.rectangle((10, 24, 21, 26), fill=fur)
    d.rectangle((10, 12, 12, 15), fill=INK)
    d.rectangle((19, 12, 21, 15), fill=INK)
    d.point((11, 12), fill=CREAM)
    d.point((20, 12), fill=CREAM)
    d.rectangle((14, 17, 17, 19), fill=INK)
    d.point((13, 21), fill=INK)
    d.point((18, 21), fill=INK)
    d.rectangle((7, 16, 9, 17), fill="#e89a8a")
    d.rectangle((22, 16, 24, 17), fill="#e89a8a")
    if accessory == "scarf":
        d.rectangle((8, 23, 23, 26), fill=AMBER)
        d.rectangle((20, 26, 24, 30), fill=AMBER)
        d.rectangle((21, 27, 22, 28), fill=INK)
    elif accessory == "cap":
        d.rectangle((7, 5, 24, 9), fill=CYAN)
        d.rectangle((11, 3, 21, 5), fill=CYAN)
        d.rectangle((20, 9, 28, 10), fill=CYAN)
    elif accessory == "bow":
        d.polygon([(21, 7), (25, 4), (27, 8), (23, 11)], fill=MAGENTA)
        d.polygon([(21, 7), (17, 4), (16, 8), (20, 11)], fill=MAGENTA)
        d.rectangle((20, 6, 22, 9), fill=AMBER)
    elif accessory == "glasses":
        d.rectangle((8, 11, 14, 16), outline=AMBER, width=1)
        d.rectangle((17, 11, 23, 16), outline=AMBER, width=1)
        d.line((14, 13, 17, 13), fill=AMBER)
    save(img, f"avatar-{name}.png")


avatar("otter", "#a87952", "#e5c39c", "round", "scarf")
avatar("cat", "#d6d0c4", "#fff4d6", "cat", "bow")
avatar("frog", "#76b86a", "#c6dda0", "round", "cap")
avatar("fox", "#d87945", "#f2d0a5", "cat", "glasses")
avatar("rabbit", "#a9a4c7", "#e6dded", "long", "scarf")
avatar("fish", "#6fa9c9", "#c4e1dd", "fin", None)


def card_back(name, base, accent, motif):
    img = image((28, 40), INK)
    d = ImageDraw.Draw(img)
    d.rectangle((2, 2, 25, 37), fill=base)
    d.rectangle((4, 4, 23, 35), outline=accent)
    for y in range(6, 34, 4):
        for x in range(6 + (y % 8) // 4, 23, 6):
            d.point((x, y), fill=accent)
    if motif == "river":
        d.line([(5, 23), (10, 18), (14, 22), (19, 14), (23, 17)], fill=CREAM, width=2)
        d.line([(5, 27), (11, 23), (16, 26), (22, 21)], fill=TEAL, width=1)
    elif motif == "sun":
        d.rectangle((11, 14, 16, 19), fill=AMBER)
        d.rectangle((12, 10, 15, 12), fill=AMBER)
        d.rectangle((12, 21, 15, 23), fill=AMBER)
        d.rectangle((7, 15, 9, 18), fill=AMBER)
        d.rectangle((18, 15, 20, 18), fill=AMBER)
    else:
        d.polygon([(14, 10), (21, 17), (14, 24), (7, 17)], outline=CREAM)
        d.rectangle((12, 15, 15, 18), fill=accent)
    save(img, f"back-{name}.png")


card_back("river", "#244a59", TEAL, "river")
card_back("amber", "#603f35", AMBER, "sun")
card_back("violet", "#473653", MAGENTA, "diamond")


def theme_river():
    img = image((384, 216), "#101c2c")
    d = ImageDraw.Draw(img)
    rng = Random(17)
    for _ in range(150):
        x, y = rng.randrange(384), rng.randrange(150)
        color = rng.choice(["#284054", "#36566a", "#5d7c85", CREAM])
        d.point((x, y), fill=color)
    d.polygon([(332, 14), (338, 14), (342, 18), (342, 24), (338, 28), (332, 28), (328, 24), (328, 18)], fill=CREAM)
    d.polygon([(0, 110), (60, 84), (105, 112), (156, 77), (214, 111), (280, 72), (340, 106), (384, 86), (384, 216), (0, 216)], fill="#162f36")
    d.polygon([(0, 148), (58, 119), (122, 142), (181, 112), (249, 145), (318, 112), (384, 138), (384, 216), (0, 216)], fill="#1d4143")
    d.polygon([(148, 216), (176, 173), (167, 146), (198, 119), (190, 99), (209, 91), (217, 112), (203, 137), (222, 163), (211, 216)], fill="#245c68")
    for _ in range(50):
        x = rng.randrange(30, 360)
        y = rng.randrange(125, 205)
        d.point((x, y), fill=rng.choice([AMBER, TEAL, "#72a875"]))
    save(img, "theme-river.png")


def theme_walnut():
    img = image((384, 216), "#2d1c1b")
    d = ImageDraw.Draw(img)
    rng = Random(29)
    for y in range(0, 216, 27):
        d.rectangle((0, y, 383, y + 1), fill="#1b1415")
        d.line((0, y + 2, 383, y + 2), fill="#4a2a24")
    for _ in range(95):
        y = rng.randrange(216)
        x = rng.randrange(360)
        length = rng.randrange(8, 55)
        color = rng.choice(["#3c2420", "#4c2b23", "#241818", "#593126"])
        d.line((x, y, min(383, x + length), y), fill=color)
        if rng.random() < 0.25:
            d.point((x + 3, y + 1), fill=color)
    for x, y in [(72, 54), (290, 142), (180, 190)]:
        d.ellipse((x - 12, y - 4, x + 12, y + 4), outline="#1e1515")
        d.ellipse((x - 6, y - 2, x + 6, y + 2), outline="#543027")
    save(img, "theme-walnut.png")


def theme_garden():
    img = image((384, 216), "#59644a")
    d = ImageDraw.Draw(img)
    rng = Random(41)
    for _ in range(650):
        x, y = rng.randrange(384), rng.randrange(216)
        color = rng.choice(["#657052", "#4c5943", "#77805b", "#3f5041", "#8a8b61"])
        d.point((x, y), fill=color)
    for _ in range(28):
        x, y = rng.randrange(384), rng.randrange(216)
        d.rectangle((x, y, x + 2, y + 1), fill="#404b42")
        d.point((x + 1, y - 1), fill="#818771")
    for _ in range(22):
        x, y = rng.randrange(384), rng.randrange(216)
        d.point((x, y), fill=AMBER)
        d.point((x - 1, y), fill=CREAM)
        d.point((x + 1, y), fill=CREAM)
        d.point((x, y - 1), fill=CREAM)
        d.point((x, y + 1), fill=CREAM)
    save(img, "theme-garden.png")


theme_river()
theme_walnut()
theme_garden()

emblem = image((48, 48), INK)
d = ImageDraw.Draw(emblem)
d.rectangle((3, 3, 44, 44), fill="#203b45")
d.rectangle((5, 5, 42, 42), outline=TEAL)
d.polygon([(12, 10), (25, 8), (29, 29), (16, 31)], fill=CREAM)
d.polygon([(23, 13), (35, 16), (29, 36), (18, 32)], fill=AMBER)
d.line([(8, 36), (16, 33), (23, 37), (31, 34), (40, 36)], fill=CYAN, width=2)
d.rectangle((17, 15, 20, 19), fill=INK)
save(emblem, "emblem.png")

print(f"Generated {len(list(OUT.glob('*.png')))} original assets in {OUT}")
