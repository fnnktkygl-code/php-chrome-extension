#!/usr/bin/env python3
"""
Renders and exports the new modern PHP logo to crisp icons:
- icons/icon16.png (16x16)
- icons/icon48.png (48x48)
- icons/icon128.png (128x128)
"""

import os
from PIL import Image, ImageDraw, ImageFilter

def render_master_logo(size=512):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # 1. Base Squircle with modern deep slate gradient
    scale = size / 512.0
    rx = int(112 * scale)
    draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=rx, fill=(15, 23, 42, 255), outline=(255, 255, 255, 25), width=int(3 * scale))

    # 2. Back History Card (The "Past" layer)
    back_card = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(back_card)
    bx0, by0, bx1, by1 = int(156 * scale), int(112 * scale), int(396 * scale), int(408 * scale)
    b_draw.rounded_rectangle([(bx0, by0), (bx1, by1)], radius=int(20 * scale), fill=(51, 65, 85, 160))
    # Rotate back card slightly for depth
    back_card = back_card.rotate(-6, resample=Image.Resampling.BICUBIC, center=(size // 2, size // 2))
    im.paste(back_card, (0, 0), back_card)

    # 3. Main Front Clipboard Card
    cx0, cy0, cx1, cy1 = int(126 * scale), int(128 * scale), int(386 * scale), int(432 * scale)
    # Drop shadow for front card
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle([(cx0, cy0 + int(8 * scale)), (cx1, cy1 + int(8 * scale))], radius=int(22 * scale), fill=(0, 0, 0, 100))
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(10 * scale)))
    im.paste(shadow, (0, 0), shadow)

    draw.rounded_rectangle([(cx0, cy0), (cx1, cy1)], radius=int(22 * scale), fill=(30, 41, 59, 255), outline=(255, 255, 255, 30), width=int(2 * scale))

    # 4. Clipboard Top Clip
    k_x0, k_y0, k_x1, k_y1 = int(196 * scale), int(104 * scale), int(316 * scale), int(152 * scale)
    draw.rounded_rectangle([(k_x0, k_y0), (k_x1, k_y1)], radius=int(12 * scale), fill=(59, 130, 246, 255))
    h_x0, h_y0, h_x1, h_y1 = int(232 * scale), int(88 * scale), int(280 * scale), int(116 * scale)
    draw.rounded_rectangle([(h_x0, h_y0), (h_x1, h_y1)], radius=int(8 * scale), fill=(37, 99, 235, 255))

    # 5. Content Lines on Clipboard
    # Header line (Blue)
    draw.rounded_rectangle([(int(166 * scale), int(188 * scale)), (int(296 * scale), int(202 * scale))], radius=int(7 * scale), fill=(59, 130, 246, 255))
    # Green category dot
    draw.ellipse([(int(324 * scale), int(188 * scale)), (int(340 * scale), int(204 * scale))], fill=(16, 185, 129, 255))

    # Text line (White/Slate)
    draw.rounded_rectangle([(int(166 * scale), int(224 * scale)), (int(346 * scale), int(236 * scale))], radius=int(6 * scale), fill=(226, 232, 240, 255))
    draw.rounded_rectangle([(int(166 * scale), int(254 * scale)), (int(316 * scale), int(266 * scale))], radius=int(6 * scale), fill=(148, 163, 184, 255))

    # Code block line
    draw.rounded_rectangle([(int(166 * scale), int(286 * scale)), (int(346 * scale), int(330 * scale))], radius=int(8 * scale), fill=(15, 23, 42, 180))
    draw.rounded_rectangle([(int(180 * scale), int(302 * scale)), (int(300 * scale), int(313 * scale))], radius=int(5 * scale), fill=(56, 189, 248, 255))

    # 6. History / Time Badge (Bottom Right)
    badge_cx, badge_cy, badge_r = int(320 * scale), int(382 * scale), int(26 * scale)
    draw.ellipse([(badge_cx - badge_r, badge_cy - badge_r), (badge_cx + badge_r, badge_cy + badge_r)], fill=(37, 99, 235, 255), outline=(255, 255, 255, 60), width=int(2 * scale))
    # Clock hands
    draw.line([(badge_cx, badge_cy - int(12 * scale)), (badge_cx, badge_cy)], fill=(255, 255, 255), width=int(3 * scale))
    draw.line([(badge_cx, badge_cy), (badge_cx + int(10 * scale), badge_cy)], fill=(255, 255, 255), width=int(3 * scale))

    return im

def generate_all_icons():
    master = render_master_logo(512)
    os.makedirs("icons", exist_ok=True)

    for size in [16, 48, 128]:
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        out_path = f"icons/icon{size}.png"
        resized.save(out_path, format="PNG")
        print(f"✅ Generated {out_path} ({size}x{size})")

if __name__ == "__main__":
    generate_all_icons()
