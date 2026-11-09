"""Render both share covers from the project's existing licensed photographs."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
FONT = Path('C:/Windows/Fonts')

def render(theme, source, ink, accent, overlay):
    image = ImageOps.fit(Image.open(ROOT / source).convert('RGB'), (1200, 630), centering=(0.5, 0.25)).convert('RGBA')
    image = Image.alpha_composite(image, Image.new('RGBA', image.size, overlay))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((34, 34, 1166, 596), radius=12, outline=accent, width=2)
    draw.rounded_rectangle((45, 45, 1155, 585), radius=8, outline=accent, width=1)
    def text(y, value, font, color):
        draw.text((600, y), value, font=font, fill=color, anchor='mt')
    text(116, 'A POCKETFUL OF POSSIBILITIES', ImageFont.truetype(str(FONT / 'msjh.ttc'), 19), accent)
    text(172, 'Skyloom', ImageFont.truetype(str(FONT / 'georgia.ttf'), 112), ink)
    text(321, 'Draw a word. Weave a world.', ImageFont.truetype(str(FONT / 'georgia.ttf'), 30), ink)
    text(378, '\u62bd\u53d6\u4e00\u500b\u8a5e\uff0c\u7de8\u7e54\u4e00\u500b\u4e16\u754c\u3002', ImageFont.truetype(str(FONT / 'msjh.ttc'), 27), ink)
    if theme == 'christmas':
        # A small evergreen and star keep the holiday cover distinct at thumbnail size.
        draw.polygon([(600, 452), (616, 476), (609, 476), (624, 497), (576, 497), (591, 476), (584, 476)], fill=ink)
        draw.rectangle((597, 497, 603, 506), fill=accent)
        draw.polygon([(600, 430), (603, 437), (610, 440), (603, 443), (600, 450), (597, 443), (590, 440), (597, 437)], fill=accent)
    else:
        draw.line((548, 476, 652, 476), fill=accent, width=2)
        draw.polygon([(600, 466), (603, 473), (610, 476), (603, 479), (600, 486), (597, 479), (590, 476), (597, 473)], fill=accent)
    image.convert('RGB').save(ROOT / f'share-{theme}.jpg', quality=92, optimize=True)

render('sky', 'skyloom-sky.jpg', '#173f50', '#95623c', (235, 248, 255, 150))
render('christmas', 'skyloom-christmas.jpg', '#234b39', '#88612e', (255, 248, 230, 165))
