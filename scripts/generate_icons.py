from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
emblem = Image.open(ROOT / "apps" / "web" / "public" / "assets" / "emblem.png").convert("RGBA")
out = ROOT / "apps" / "web" / "public" / "icons"
out.mkdir(parents=True, exist_ok=True)

for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    canvas = Image.new("RGBA", (size, size), "#171716")
    inset = max(1, size // 16)
    scaled = emblem.resize((size - inset * 2, size - inset * 2), Image.Resampling.NEAREST)
    canvas.alpha_composite(scaled, (inset, inset))
    canvas.save(out / name, optimize=True)

resources = ROOT / "apps" / "web" / "resources"
resources.mkdir(parents=True, exist_ok=True)
icon = Image.new("RGBA", (1024, 1024), "#171716")
scaled = emblem.resize((896, 896), Image.Resampling.NEAREST)
icon.alpha_composite(scaled, (64, 64))
icon.save(resources / "icon.png", optimize=True)

splash = Image.new("RGBA", (2732, 2732), "#171716")
scaled = emblem.resize((768, 768), Image.Resampling.NEAREST)
splash.alpha_composite(scaled, ((2732 - 768) // 2, (2732 - 768) // 2))
splash.save(resources / "splash.png", optimize=True)

print("Generated web, touch, and native icons")
