#!/usr/bin/env python3
"""
Renders and exports the modern vibrant PHP logo to crisp icons:
- icons/icon16.png (16x16)
- icons/icon48.png (48x48)
- icons/icon128.png (128x128)
Features a vibrant Electric Blue squircle on transparent canvas, matching modern top Chrome Web Store standards (Mino, Coupert, Google Docs).
"""

import os
from PIL import Image, ImageDraw, ImageFilter

def render_master_logo(size=512):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    scale = size / 512.0

    # 1. Base Vibrant Brand Squircle (Electric Blue / Sapphire) on 100% Transparent Canvas
    margin = int(28 * scale)
    sq_x0, sq_y0, sq_x1, sq_y1 = margin, margin, size - margin, size - margin
    rx = int(108 * scale)

    # Subtle soft blue drop shadow
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle([(sq_x0, sq_y0 + int(8 * scale)), (sq_x1, sq_y1 + int(8 * scale))], radius=rx, fill=(29, 78, 216, 75))
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(12 * scale)))
    im.paste(shadow, (0, 0), shadow)

    draw = ImageDraw.Draw(im)
    # Vibrant primary squircle
    draw.rounded_rectangle([(sq_x0, sq_y0), (sq_x1, sq_y1)], radius=rx, fill=(37, 99, 235, 255), outline=(255, 255, 255, 60), width=int(2.5 * scale))

    # 2. Back History Sheet (The "Past" layer)
    back_card = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(back_card)
    bx0, by0, bx1, by1 = int(168 * scale), int(118 * scale), int(368 * scale), int(382 * scale)
    b_draw.rounded_rectangle([(bx0, by0), (bx1, by1)], radius=int(18 * scale), fill=(255, 255, 255, 95))
    back_card = back_card.rotate(-7, resample=Image.Resampling.BICUBIC, center=(size // 2, size // 2))
    im.paste(back_card, (0, 0), back_card)

    # 3. Main Front White Clipboard
    cx0, cy0, cx1, cy1 = int(136 * scale), int(128 * scale), int(376 * scale), int(408 * scale)
    # Card soft shadow
    c_shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cs_draw = ImageDraw.Draw(c_shadow)
    cs_draw.rounded_rectangle([(cx0, cy0 + int(6 * scale)), (cx1, cy1 + int(6 * scale))], radius=int(22 * scale), fill=(15, 23, 42, 60))
    c_shadow = c_shadow.filter(ImageFilter.GaussianBlur(int(8 * scale)))
    im.paste(c_shadow, (0, 0), c_shadow)

    draw.rounded_rectangle([(cx0, cy0), (cx1, cy1)], radius=int(22 * scale), fill=(255, 255, 255, 255), outline=(241, 245, 249, 255), width=int(1.5 * scale))

    # 4. Top Clip Fastener
    k_x0, k_y0, k_x1, k_y1 = int(196 * scale), int(104 * scale), int(316 * scale), int(148 * scale)
    draw.rounded_rectangle([(k_x0, k_y0), (k_x1, k_y1)], radius=int(10 * scale), fill=(59, 130, 246, 255))
    h_x0, h_y0, h_x1, h_y1 = int(230 * scale), int(86 * scale), int(282 * scale), int(112 * scale)
    draw.rounded_rectangle([(h_x0, h_y0), (h_x1, h_y1)], radius=int(8 * scale), fill=(30, 64, 175, 255))

    # 5. Content Lines on Clipboard
    # Header line (Blue)
    draw.rounded_rectangle([(int(172 * scale), int(184 * scale)), (int(287 * scale), int(198 * scale))], radius=int(7 * scale), fill=(37, 99, 235, 255))
    # Green category dot
    draw.ellipse([(int(322 * scale), int(184 * scale)), (int(338 * scale), int(200 * scale))], fill=(16, 185, 129, 255))

    # Text line (Slate)
    draw.rounded_rectangle([(int(172 * scale), int(218 * scale)), (int(340 * scale), int(230 * scale))], radius=int(6 * scale), fill=(100, 116, 139, 255))
    draw.rounded_rectangle([(int(172 * scale), int(246 * scale)), (int(310 * scale), int(258 * scale))], radius=int(6 * scale), fill=(148, 163, 184, 255))

    # Code block container
    draw.rounded_rectangle([(int(172 * scale), int(276 * scale)), (int(340 * scale), int(314 * scale))], radius=int(8 * scale), fill=(241, 245, 249, 255), outline=(226, 232, 240, 255), width=int(1.5 * scale))
    draw.rounded_rectangle([(int(186 * scale), int(290 * scale)), (int(281 * scale), int(300 * scale))], radius=int(5 * scale), fill=(59, 130, 246, 255))

    # 6. History / Time Badge (Bottom Right Accent)
    badge_cx, badge_cy, badge_r = int(328 * scale), int(362 * scale), int(24 * scale)
    draw.ellipse([(badge_cx - badge_r, badge_cy - badge_r), (badge_cx + badge_r, badge_cy + badge_r)], fill=(29, 78, 216, 255), outline=(255, 255, 255, 255), width=int(2.5 * scale))
    draw.line([(badge_cx, badge_cy - int(11 * scale)), (badge_cx, badge_cy)], fill=(255, 255, 255), width=int(2.5 * scale))
    draw.line([(badge_cx, badge_cy), (badge_cx + int(9 * scale), badge_cy)], fill=(255, 255, 255), width=int(2.5 * scale))

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
