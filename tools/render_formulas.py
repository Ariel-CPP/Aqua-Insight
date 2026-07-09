import os
from PIL import Image, ImageDraw, ImageFont

# Set up paths
assets_dir = r"C:\Users\Ariel's Device\.gemini\antigravity\scratch\aqua-insight\assets"
os.makedirs(assets_dir, exist_ok=True)

# Try to load a nice font, fallback to default if not found
try:
    font_path = "segoeui.ttf"  # Windows standard UI font
    font_large = ImageFont.truetype(font_path, 20)
    font_small = ImageFont.truetype(font_path, 14)
except IOError:
    font_large = ImageFont.load_default()
    font_small = ImageFont.load_default()

def create_formula_image(filename, text_parts, width=750, height=45):
    # Create image with transparent background
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw text parts with inline colors
    current_x = 20
    y_pos = (height - 24) // 2
    
    for text, color in text_parts:
        draw.text((current_x, y_pos), text, font=font_large, fill=color)
        # Calculate width of the text to advance current_x
        # In newer Pillow versions, use draw.textlength
        try:
            w = draw.textlength(text, font=font_large)
        except AttributeError:
            # Fallback for older Pillow
            w = draw.textsize(text, font=font_large)[0]
        current_x += int(w)
        
    # Save the image
    save_path = os.path.join(assets_dir, filename)
    img.save(save_path)
    print(f"Saved {save_path}")

# 1. Mortality Risk Formula
# Risiko Kematian = max(Stres Suhu, Stres DO, Stres pH, Stres TAN, Stres NO2, Stres Salinitas, Stres Penyakit)
parts_mortality = [
    ("Risiko Kematian = ", (255, 255, 255, 255)),
    ("max", (0, 242, 254, 255)),
    ("(", (255, 255, 255, 255)),
    ("Stres Suhu", (245, 158, 11, 255)),
    (", ", (255, 255, 255, 255)),
    ("Stres DO", (0, 242, 254, 255)),
    (", ", (255, 255, 255, 255)),
    ("Stres pH", (168, 85, 247, 255)),
    (", ", (255, 255, 255, 255)),
    ("Stres TAN", (239, 68, 68, 255)),
    (", ", (255, 255, 255, 255)),
    ("Stres NO2", (249, 115, 22, 255)),
    (", ", (255, 255, 255, 255)),
    ("Stres Salinitas", (6, 182, 212, 255)),
    (", ", (255, 255, 255, 255)),
    ("Stres Penyakit", (244, 63, 94, 255)),
    (")", (255, 255, 255, 255))
]
create_formula_image("formula_mortality.png", parts_mortality, width=820, height=45)

# 2. Time-Decay Boost Formula
# Stres Penyakit = Severity Boost * max(0, 1 - (Hari Sejak Kejadian / 14))
parts_boost = [
    ("Stres Penyakit = ", (255, 255, 255, 255)),
    ("Severity Boost", (244, 63, 94, 255)),
    (" * ", (255, 255, 255, 255)),
    ("max", (0, 242, 254, 255)),
    ("(0, 1 - (", (255, 255, 255, 255)),
    ("Hari Sejak Kejadian", (0, 242, 254, 255)),
    (" / 14))", (255, 255, 255, 255))
]
create_formula_image("formula_boost.png", parts_boost, width=540, height=45)

# 3. OLS Trend Formula
# Prediksi Parameter = (Slope * Hari) + Intercept
parts_ols = [
    ("Prediksi Parameter = (", (255, 255, 255, 255)),
    ("Slope", (245, 158, 11, 255)),
    (" * ", (255, 255, 255, 255)),
    ("Hari", (0, 242, 254, 255)),
    (") + ", (255, 255, 255, 255)),
    ("Intercept", (168, 85, 247, 255))
]
create_formula_image("formula_ols.png", parts_ols, width=400, height=45)
