# Generates a realistic handwritten-style delivery note for testing the AI.
from PIL import Image, ImageDraw, ImageFont
import random

W, H = 900, 1150
img = Image.new("RGB", (W, H), (250, 248, 240))  # cream paper
draw = ImageDraw.Draw(img)

hand = "/System/Library/Fonts/Supplemental/Bradley Hand Bold.ttf"
big = ImageFont.truetype(hand, 54)
mid = ImageFont.truetype(hand, 40)
small = ImageFont.truetype(hand, 34)

ink = (30, 30, 60)

# faint ruled lines, like a notebook page
for y in range(180, H, 70):
    draw.line([(40, y), (W - 40, y)], fill=(220, 220, 210), width=2)

draw.text((60, 50), "Sri Ram Dairy", font=big, fill=ink)
draw.text((60, 115), "Date: 11/06  -  Morning", font=small, fill=(90, 90, 110))

# (handwritten item, quantity text) — mixes crates, packets, plain numbers
items = [
    ("Toned Milk", "2 crate"),
    ("Full Cream Milk", "1 crate"),
    ("Cow Milk", "20 pkt"),
    ("Curd", "15"),
    ("Paneer", "6 packet"),
    ("White Bread", "8"),
    ("Eggs", "3 tray"),
]

y = 210
for name, qty in items:
    jitter = random.randint(-4, 4)
    draw.text((70, y + jitter), name, font=mid, fill=ink)
    draw.text((640, y + jitter), "- " + qty, font=mid, fill=ink)
    y += 130

draw.text((60, y + 30), f"Total {len(items)} items", font=small, fill=(90, 90, 110))
draw.text((600, y + 90), "~ Ramesh", font=mid, fill=(120, 60, 60))

out = "public/uploads/mock_note.png"
img.save(out)
print("Saved", out)
