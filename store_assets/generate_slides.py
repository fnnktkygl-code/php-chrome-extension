from PIL import Image, ImageDraw, ImageFont
import os

# Configuration
CANVAS_SIZE = (1280, 800)
BG_COLOR = (30, 41, 59) # #1e293b
TEXT_COLOR = (255, 255, 255)
OFFSET_TOP_TEXT = 60
OFFSET_TOP_IMG = 160
IMG_Target_HEIGHT = 600

# Try to load a nice system font
FONT_PATH = "/System/Library/Fonts/Helvetica.ttc"
if not os.path.exists(FONT_PATH):
    FONT_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf"

try:
    font = ImageFont.truetype(FONT_PATH, 55, index=0) # Index 0 usually fits
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

def create_slide(slide_config):
    # 1. Create Canvas
    img = Image.new('RGB', CANVAS_SIZE, color=BG_COLOR)
    draw = ImageDraw.Draw(img)

    # 2. Draw Title
    title = slide_config["title"]
    # center text
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


    # 3. Load and Resize Source Screenshot
    try:
        source_path = os.path.join("store_assets", slide_config["source"])
        if not os.path.exists(source_path):
             # Try alternate name for links if needed
             if slide_config["source"] == "links.png" and not os.path.exists(source_path):
                 source_path = os.path.join("store_assets", "liens.png")
        
        src_img = Image.open(source_path)
        
        # Calculate aspect ratio
        aspect = src_img.width / src_img.height
        new_w = int(IMG_Target_HEIGHT * aspect)
        new_h = IMG_Target_HEIGHT
        
        src_img_resized = src_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # 4. Paste Centered
        img_x = (CANVAS_SIZE[0] - new_w) // 2
        img.paste(src_img_resized, (img_x, OFFSET_TOP_IMG))
        
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
