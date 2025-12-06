from PIL import Image, ImageDraw, ImageFont
import os

# Configuration
CANVAS_SIZE = (1280, 800)
BG_COLOR = (30, 41, 59) # #1e293b
TEXT_COLOR = (255, 255, 255)
OFFSET_TOP_TEXT = 50
OFFSET_TOP_IMG = 130
IMG_Target_HEIGHT = 640 # Increased from 600

# Try to load a nice system font
FONT_PATH = "/System/Library/Fonts/Helvetica.ttc"
if not os.path.exists(FONT_PATH):
    FONT_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf"

try:
    font = ImageFont.truetype(FONT_PATH, 65, index=0) # Increased font size
except:
    font = ImageFont.load_default() # Fallback

SLIDES = [
    {
        "name": "consistent_main.png",
        "source": "tout.png",
        "title": "Secure & Local Clipboard History"
    },
    {
        "name": "consistent_links.png",
        "source": "liens.png", 
        "title": "Detect & Organize Links"
    },
    {
        "name": "consistent_search.png",
        "source": "rechercher.png",
        "title": "Instant Search & Filters"
    }
]

def add_corners(im, rad):
    circle = Image.new('L', (rad * 2, rad * 2), 0)
    draw = ImageDraw.Draw(circle)
    draw.ellipse((0, 0, rad * 2 - 1, rad * 2 - 1), fill=255)
    
    alpha = Image.new('L', im.size, 255)
    w, h = im.size
    
    # Handle if image already has alpha
    if im.mode == 'RGBA':
        alpha = im.split()[3]
    
    # Create mask for corners
    mask = Image.new('L', (w, h), 255)
    mask.paste(circle.crop((0, 0, rad, rad)), (0, 0))
    mask.paste(circle.crop((0, rad, rad, rad * 2)), (0, h - rad))
    mask.paste(circle.crop((rad, 0, rad * 2, rad)), (w - rad, 0))
    mask.paste(circle.crop((rad, rad, rad * 2, rad * 2)), (w - rad, h - rad))
    
    # Apply mask
    im.putalpha(mask)
    return im

def add_shadow(im, blur_radius=40, shadow_color=(0, 0, 0, 100), offset=(0, 15)):
    from PIL import ImageFilter
    
    w, h = im.size
    padding = blur_radius * 2
    
    # Shadow canvas
    shadow_w = w + padding
    shadow_h = h + padding
    shadow = Image.new('RGBA', (shadow_w, shadow_h), (0,0,0,0))
    draw = ImageDraw.Draw(shadow)
    
    # Draw shadow rect
    shadow_rect = (
        padding // 2 + offset[0],
        padding // 2 + offset[1],
        padding // 2 + offset[0] + w,
        padding // 2 + offset[1] + h
    )
    
    draw.rectangle(shadow_rect, fill=shadow_color, outline=None)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur_radius))
    
    # Paste original image
    shadow.paste(im, (padding // 2, padding // 2), im)
    
    return shadow

def create_slide(slide_config):
    # 1. Create Canvas
    img = Image.new('RGB', CANVAS_SIZE, color=BG_COLOR)
    draw = ImageDraw.Draw(img)

    # 2. Draw Title
    title = slide_config["title"]
    try:
        text_bbox = draw.textbbox((0, 0), title, font=font)
        text_w = text_bbox[2] - text_bbox[0]
        text_x = (CANVAS_SIZE[0] - text_w) // 2
        draw.text((text_x, OFFSET_TOP_TEXT), title, font=font, fill=TEXT_COLOR)
    except AttributeError:
        # Fallback for older PIL
        text_w, text_h = draw.textsize(title, font=font)
        text_x = (CANVAS_SIZE[0] - text_w) // 2
        draw.text((text_x, OFFSET_TOP_TEXT), title, font=font, fill=TEXT_COLOR)


    # 3. Load and Process Source Screenshot
    try:
        source_path = os.path.join("store_assets", slide_config["source"])
        src_img = Image.open(source_path).convert("RGBA")
        
        # Resize
        aspect = src_img.width / src_img.height
        new_w = int(IMG_Target_HEIGHT * aspect)
        new_h = IMG_Target_HEIGHT
        
        src_img_resized = src_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Add Corners
        src_img_processed = add_corners(src_img_resized, rad=16)
        
        # Add Shadow
        src_img_final = add_shadow(src_img_processed)
        
        # 4. Paste Centered (compensating for shadow padding)
        # Shadow image is larger than original resized image by blur_radius*2
        # We want to center the VISIBLE image (not the shadow bounds)
        padding = 40 * 2 # blur_radius * 2
        
        total_w = src_img_final.width
        # visible_w = new_w
        
        # x position to center the VISIBLE part
        # center of canvas = 640
        # center of visible image relative to shadow canvas = padding//2 + new_w//2
        # we want (screen_x + padding//2) to start such that image is centered?
        
        # Easier: 
        # The shadow image has padding on all sides.
        # If we paste the shadow image such that its center aligns with canvas center...
        
        paste_x = (CANVAS_SIZE[0] - total_w) // 2
        paste_y = OFFSET_TOP_IMG - (padding // 2) # Pull up slightly to account for shadow padding top
        
        img.paste(src_img_final, (paste_x, paste_y), src_img_final)
        
        # 5. Save
        out_path = os.path.join("store_assets", slide_config["name"])
        img.save(out_path)
        print(f"Generated {out_path}")
        
    except Exception as e:
        print(f"Error processing {slide_config['name']}: {e}")

if __name__ == "__main__":
    if not os.path.exists("store_assets"):
        os.makedirs("store_assets")

    for slide in SLIDES:
        create_slide(slide)
