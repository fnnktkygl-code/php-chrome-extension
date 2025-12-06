from PIL import Image, ImageDraw, ImageFont
import os

# Configuration
BG_COLOR = (30, 41, 59) # #1e293b
TEXT_COLOR = (255, 255, 255)

# Fonts
FONT_PATH = "/System/Library/Fonts/Helvetica.ttc"
if not os.path.exists(FONT_PATH):
    FONT_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf"

def get_font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size, index=0)
    except:
        return ImageFont.load_default()

def add_shadow(im, blur_radius=20, offset=(0, 10)):
    from PIL import ImageFilter
    w, h = im.size
    padding = blur_radius * 2
    shadow = Image.new('RGBA', (w + padding, h + padding), (0,0,0,0))
    draw = ImageDraw.Draw(shadow)
    shadow_rect = (padding // 2 + offset[0], padding // 2 + offset[1], padding // 2 + offset[0] + w, padding // 2 + offset[1] + h)
    draw.rectangle(shadow_rect, fill=(0, 0, 0, 80))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur_radius))
    shadow.paste(im, (padding // 2, padding // 2), im)
    return shadow

def create_marquee():
    WIDTH, HEIGHT = 1400, 560
    img = Image.new('RGB', (WIDTH, HEIGHT), color=BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Text
    title = "PHP - Paste History Past"
    subtitle = "Secure. Local. Efficient."
    
    font_title = get_font(72)
    font_sub = get_font(42)

    draw.text((80, 180), title, font=font_title, fill=TEXT_COLOR)
    draw.text((80, 270), subtitle, font=font_sub, fill=(200, 210, 230))

    # Screenshot Composite
    try:
        if os.path.exists("store_assets/tout_dark.png"):
            screen = Image.open("store_assets/tout_dark.png").convert("RGBA")
        elif os.path.exists("store_assets/tout.png"):
             screen = Image.open("store_assets/tout.png").convert("RGBA")
        else:
            print("Warning: No main screenshot found for marquee.")
            screen = None

        if screen:
            # Resize
            target_h = 450
            aspect = screen.width / screen.height
            new_w = int(target_h * aspect)
            screen = screen.resize((new_w, target_h), Image.Resampling.LANCZOS)
            
            # Simple corner rounding hack (optional, skipped for speed/robustness)
            
            # Shadow
            screen = add_shadow(screen)
            
            # Paste on Right
            img.paste(screen, (900, 55), screen)
            
    except Exception as e:
        print(f"Error adding screenshot to marquee: {e}")

    img.save("store_assets/marquee_promo_tile_1400x560.png")
    print("Generated marquee_promo_tile_1400x560.png")

def create_small_tile():
    WIDTH, HEIGHT = 440, 280
    img = Image.new('RGB', (WIDTH, HEIGHT), color=BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Icon
    try:
        icon_path = "icons/icon128.png"
        if os.path.exists(icon_path):
            icon = Image.open(icon_path).convert("RGBA")
            # Center icon horizontally, push up slightly
            icon_x = (WIDTH - icon.width) // 2
            icon_y = (HEIGHT - icon.height) // 2 - 20
            img.paste(icon, (icon_x, icon_y), icon)
    except Exception as e:
        print(f"Error adding icon: {e}")

    # Text below icon
    title = "Paste History Past"
    font_title = get_font(28)
    
    # Measure text
    try:
        text_bbox = draw.textbbox((0, 0), title, font=font_title)
        text_w = text_bbox[2] - text_bbox[0]
    except:
        text_w, _ = draw.textsize(title, font=font_title)
    
    text_x = (WIDTH - text_w) // 2
    text_y = 190
    draw.text((text_x, text_y), title, font=font_title, fill=TEXT_COLOR)

    img.save("store_assets/small_promo_tile_440x280.png")
    print("Generated small_promo_tile_440x280.png")

if __name__ == "__main__":
    create_marquee()
    create_small_tile()
