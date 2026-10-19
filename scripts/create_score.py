from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEADER = """jacquard 20
tempo 116
meter 4 4
fx rsize=0.72 rtone=0.42 rspread=1 dbeats=0.5 dfb=0.28 dtone=0.42 dspread=0.55
limiter ceiling=-7 attack=0.004 release=0.08
mutes muted=00000000 soloed=00000000
scale notes=101011010101
patch 1 transpose=0 level=-14 pan=-0.12 uni=0.18 gate=0.92 mratio=2 index=1.1 fb=0 md=0.68 ca=0.025 cr=0.38 ps=0 pd=0.2 rsend=0.42 dsend=0.18
patch 2 transpose=0 level=-20 pan=0.12 uni=0.3 gate=1 mratio=1 index=0.65 fb=0 md=0.82 ca=0.35 cr=0.85 ps=0 pd=0.2 rsend=0.58 dsend=0.06
patch 3 transpose=0 level=-14 pan=0 uni=0 gate=0.94 mratio=1 index=1.25 fb=0 md=0.72 ca=0.008 cr=0.34 ps=0 pd=0.2 rsend=0.12 dsend=0
patch 4 transpose=0 level=-19 pan=0.16 uni=0.12 gate=0.76 mratio=2 index=1.35 fb=0 md=0.55 ca=0.004 cr=0.26 ps=0 pd=0.2 rsend=0.38 dsend=0.22
patch 5 transpose=0 level=-22 pan=-0.16 uni=0 gate=1 mratio=3.5 index=1.7 fb=0 md=0.62 ca=0.003 cr=0.55 ps=0 pd=0.2 rsend=0.55 dsend=0.36
patch 6 transpose=0 level=-2 pan=0 uni=0 gate=1 mratio=3 index=1 fb=0 md=0.5 ca=0.005 cr=0.1 ps=0 pd=0.2 rsend=0 dsend=0
patch 7 transpose=0 level=-2 pan=0 uni=0 gate=1 mratio=3 index=1 fb=0 md=0.5 ca=0.005 cr=0.1 ps=0 pd=0.2 rsend=0 dsend=0
patch 8 transpose=0 level=-2 pan=0 uni=0 gate=1 mratio=3 index=1 fb=0 md=0.5 ca=0.005 cr=0.1 ps=0 pd=0.2 rsend=0 dsend=0
"""

MELODY = [
    "D5", "F5", "A5", "G5", "F5", "E5", "D5", "A4",
    "C5", "E5", "G5", "F5", "E5", "D5", "C5", "G4",
    "A#4", "D5", "F5", "E5", "D5", "C5", "A4", "F4",
    "A4", "C5", "E5", "D5", "C5", "A#4", "A4", "E4",
    "D5", "F5", "A5", "C6", "A#5", "A5", "G5", "F5",
    "E5", "G5", "A#5", "A5", "G5", "F5", "E5", "D5",
    "C5", "E5", "G5", "F5", "E5", "D5", "C5", "A#4",
    "A4", "D5", "C5", "A4", "G4", "F4", "E4", "D4",
]
CHORDS = [
    (["D3", "F3", "A3"], "D2"),
    (["A#2", "D3", "F3"], "A#1"),
    (["F3", "A3", "C4"], "F2"),
    (["C3", "E3", "G3"], "C2"),
    (["D3", "F3", "A3"], "D2"),
    (["A#2", "D3", "F3"], "A#1"),
    (["A#2", "D3", "G3"], "G2"),
    (["A2", "C#3", "E3"], "A1"),
]


def lane(channel, y, steps):
    lines = [f"lane 11 {y} CHAN:{channel} div=16 on=1"]
    lines.extend(f"  step {step}".rstrip() for step in steps)
    return "\n".join(lines) + "\n"


melody_steps = []
for index, note in enumerate(MELODY):
    duration = 6 if index in {7, 15, 23, 31, 39, 47, 55} else 2
    if index == 63:
        duration = 10
    melody_steps.extend([f"{note}/{duration}", ""])

chord_steps = []
bass_steps = []
arp_steps = []
sparkle_steps = [""] * 128
for chord_index, (notes, bass) in enumerate(CHORDS):
    chord_steps.extend([" ".join(f"{note}/16" for note in notes)] + [""] * 15)
    bass_steps.extend([f"{bass}/8"] + [""] * 7 + [f"{bass}/8"] + [""] * 7)
    arpeggio = [notes[0], notes[1], notes[2], notes[1], notes[0], notes[1], notes[2], notes[1]]
    for note in arpeggio:
        arp_steps.extend([f"{note}/2", ""])
    sparkle_steps[chord_index * 16] = f"{notes[2][:-1]}6/8" if chord_index in {0, 4} else ""

score = HEADER
score += lane(1, 8, melody_steps[:128])
score += lane(2, 16, chord_steps)
score += lane(3, 24, bass_steps)
score += lane(4, 32, arp_steps)
score += lane(5, 40, sparkle_steps)

output = ROOT / "apps" / "web" / "public" / "assets" / "music"
output.mkdir(parents=True, exist_ok=True)
(output / "riverlight.jacquard").write_text(score, encoding="utf-8")
(ROOT / ".reference" / "riverlight-candidate.jacquard").write_text(score, encoding="utf-8")
print(f"Wrote {len(score.splitlines())} score lines")
