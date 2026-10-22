"""Compose store media from real extension captures of generated demo fixtures.

Requires Pillow. Inputs remain unmodified; crops, scale and surrounding copy are
declared below. No translation/model quality or provider latency is simulated as
a product claim. Run from any directory with Python 3.
"""
from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.8.8"
BASE_CAPTURE_VERSION = "0.8.7"
DEST = ROOT / "branding" / f"store-{VERSION}"
SOURCES = DEST / "sources"
FONTS = Path("C:/Windows/Fonts")


def font(size, bold=False):
    return ImageFont.truetype(str(FONTS / ("segoeuib.ttf" if bold else "segoeui.ttf")), size)


SLIDES = [
    dict(slug="01-immersive", category="WEB READING", title="Read in two languages. Stay in context.",
         subtitle="Immersive webpage translation powered by your own translation API.",
         source=f"qudadflow-functional-edge-v{BASE_CAPTURE_VERSION}.png", crop=(220, 100, 1220, 850), aside=[
             ("Original + translation", "Read each translation beside\nits source paragraph."),
             ("Keep the context", "Preserve ordinary links\nand page structure."),
             ("Read as you scroll", "Nearby text gets priority\nwhen a page starts translating.")],
         note="Illustrative demo · Simulated API responses · Speed and quality depend on your provider",
         caption_en="Immersive bilingual webpage reading — simulated translation demo",
         caption_zh="网页沉浸双语阅读（模拟接口演示）"),
    dict(slug="02-selection", category="SELECTION TRANSLATION", title="Select a passage. Translate beside it.",
         subtitle="Use the nearby translation button, the context menu or Alt + Shift + T.",
         source=f"qudadflow-functional-selection-v{BASE_CAPTURE_VERSION}.png", crop=(270, 185, 1190, 580), aside=[],
         note="Illustrative demo · Simulated API response and timing · Site button requires opt-in",
         caption_en="Nearby selection translation — simulated response and timing",
         caption_zh="就近划词翻译（模拟结果及耗时演示）"),
    dict(slug="03-documents", category="DOCUMENT READING", title="Keep the page. Change the language.",
         subtitle="PDF · Word DOCX · TXT · Markdown — immersive or side-by-side reading.",
         source=f"qudadflow-inplace-pdf-v{BASE_CAPTURE_VERSION}.png", crop=(0, 65, 1440, 1030), aside=[
             ("PDF page proportions", "Keep images and charts\nin their original positions."),
             ("Choose your view", "In-place, original-layout\nor paired paragraphs."),
             ("Read the full meaning", "Open the complete translation\nwhen text cannot fit.")],
         note="Generated PDF · Simulated translation · No layout-preserving PDF/DOCX export",
         caption_en="PDF in-place and original-layout comparison — generated document demo",
         caption_zh="PDF 原位及原版对照阅读（生成文档演示）"),
    dict(slug="04-paper-figures", category="PAPER FIGURES & TABLES", title="Read the full table. Keep the evidence.",
         subtitle="Merge duplicate figure variants. Read linked tables into copy/export and paper Q&A.",
         source=f"qudadflow-linked-tables-1440-v{VERSION}.png", crop=(26, 390, 1414, 1082), aside=[],
         note="0.8.8 UI · Generated table and mock figures · Loading tables does not call AI",
         caption_en="Linked full tables, copyable rows and figure overview — generated 0.8.8 fixture",
         caption_zh="完整表格链接、可复制表格与图表总览（0.8.8 生成样例）"),
    dict(slug="05-reading-preferences", category="READING PREFERENCES", title="Your colors. Your reading shortcut.",
         subtitle="Default Shift + A. Type or record a shortcut, then save your choice.",
         source=f"qudadflow-reading-preferences-1180-v{BASE_CAPTURE_VERSION}.png", crop=(20, 285, 842, 751), aside=[],
         note="Real settings UI · Applies to granted webpage bodies · Inputs and editors keep their shortcuts",
         caption_en="Custom immersive colors and editable Shift+A shortcut — real settings UI",
         caption_zh="沉浸式颜色及可手动修改、录制的 Shift+A 快捷键（实际设置界面）"),
    dict(slug="06-model-settings", category="SETTINGS & MODELS", title="Choose a model your provider returns.",
         subtitle="Search upstream models, inspect reported capabilities and test before saving.",
         source=f"qudadflow-model-settings-v{BASE_CAPTURE_VERSION}.png", crop=(380, 409, 1240, 960), aside=[
             ("Explicit model choice", "Browse the returned catalog,\nthen apply your selection."),
             ("Reported capabilities", "Missing metadata stays\nmarked as unknown."),
             ("Test your draft", "A connection test does not\nsave or activate changes.")],
         note="Example API catalog · Capabilities are provider-declared · Test does not verify image input",
         caption_en="Redesigned settings and upstream model discovery — example API catalog",
         caption_zh="新版设置及上游模型读取（示例 API 模型列表）"),
]


def compose(index, spec):
    # Code-native frame; screenshot pixels only undergo uniform scaling/cropping.
    canvas = Image.new("RGB", (1280, 800))
    px = canvas.load()
    for y in range(800):
        for x in range(1280):
            glow = max(0, 1 - ((x - 1130) ** 2 / 900000 + (y - 80) ** 2 / 500000))
            px[x, y] = (int(12 + glow * 13), int(18 + glow * 12), int(36 + glow * 31))
    d = ImageDraw.Draw(canvas)
    logo = Image.open(ROOT / "assets" / "icon128.png").convert("RGBA").resize((44, 44), Image.Resampling.LANCZOS)
    canvas.paste(logo, (48, 30), logo)
    d.text((106, 36), "QudadFlow Translator", font=font(23, True), fill="#f5f8ff")
    d.text((1060, 41), f"EDGE + CHROME / {VERSION}", font=font(12), fill="#a4b2ce")
    d.line((48, 94, 1232, 94), fill="#2a3554", width=1)
    d.text((48, 110), f"{index:02d}  /  {spec['category']}", font=font(13, True), fill="#71e5d0")
    title_font = font(43, True)
    assert d.textbbox((0, 0), spec["title"], font=title_font)[2] <= 1184
    d.text((46, 138), spec["title"], font=title_font, fill="#ffffff")
    d.text((48, 199), spec["subtitle"], font=font(19), fill="#b9c7e1")

    d.rounded_rectangle((48, 246, 1232, 728), radius=18, fill="#f3f6fc", outline="#6a7894", width=1)
    image_area = (64, 260, 860 if spec["aside"] else 1216, 714)
    capture = Image.open(SOURCES / spec["source"]).convert("RGB")
    crop = spec["crop"]
    assert 0 <= crop[0] < crop[2] <= capture.width and 0 <= crop[1] < crop[3] <= capture.height
    capture = capture.crop(crop)
    available_w, available_h = image_area[2] - image_area[0], image_area[3] - image_area[1]
    scale = min(available_w / capture.width, available_h / capture.height)
    capture = capture.resize((round(capture.width * scale), round(capture.height * scale)), Image.Resampling.LANCZOS)
    pos = (image_area[0] + (available_w - capture.width) // 2, image_area[1] + (available_h - capture.height) // 2)
    canvas.paste(capture, pos)
    if spec["aside"]:
        d.line((881, 280, 881, 693), fill="#d9e1f0", width=1)
        for i, (title, text) in enumerate(spec["aside"]):
            y = 291 + i * 130
            d.rounded_rectangle((910, y + 6, 917, y + 13), radius=3, fill="#3b61cb")
            d.text((931, y), title, font=font(20, True), fill="#172c4c")
            d.multiline_text((931, y + 35), text, font=font(16), fill="#526782", spacing=7)
    note_font = font(14)
    assert d.textbbox((0, 0), spec["note"], font=note_font)[2] < 1184
    d.text((48, 753), spec["note"], font=note_font, fill="#a8b7d2")
    dest = DEST / f"qudadflow-{spec['slug']}.png"
    canvas.save(dest, optimize=True)
    return dest


DEST.mkdir(parents=True, exist_ok=True)
SOURCES.mkdir(parents=True, exist_ok=True)
for slide in SLIDES:
    slide["capture_version"] = VERSION if slide["slug"] == "04-paper-figures" else BASE_CAPTURE_VERSION
    if slide["capture_version"] != VERSION:
        slide["note"] += " · 0.8.7 capture"
    shutil.copyfile(ROOT / "docs" / slide["source"], SOURCES / slide["source"])
records = []
for i, slide in enumerate(SLIDES, 1):
    destination = compose(i, slide)
    records.append({**slide, "file": destination.name, "dimensions": [1280, 800],
                    "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                    "source_sha256": hashlib.sha256((SOURCES / slide["source"]).read_bytes()).hexdigest()})
(DEST / "media.json").write_text(json.dumps({"version": VERSION, "source": "Linked-table capture: real 0.8.8 UI with generated table and mock figure thumbnails. Five unchanged feature views reuse 0.8.7 captures with generated fixtures, synthetic API responses and an example model catalog. Capture versions, crops and hashes are recorded below; provider speed and accuracy are not measured.", "screenshots": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
# Review-only contact sheet, not a store screenshot.
sheet = Image.new("RGB", (1280, 1200), "#dce3ef")
for i, item in enumerate(records):
    thumb = Image.open(DEST / item["file"]).resize((640, 400), Image.Resampling.LANCZOS)
    sheet.paste(thumb, ((i % 2) * 640, (i // 2) * 400))
sheet.save(DEST / "preview.jpg", quality=91)
print(json.dumps({"output": str(DEST), "screenshots": len(records), "dimensions": "1280x800"}))
