"""Build versioned store screenshots from the captured extension UI."""
from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "branding" / "store-0.9.0"
SOURCES = DEST / "sources"
PRIOR = ROOT / "branding" / "store-0.8.16"
FONTS = Path("C:/Windows/Fonts")


def font(size, bold=False):
    return ImageFont.truetype(str(FONTS / ("segoeuib.ttf" if bold else "segoeui.ttf")), size)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fit(image, box):
    width, height = box[2] - box[0], box[3] - box[1]
    scale = min(width / image.width, height / image.height)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    return image, (box[0] + (width - image.width) // 2, box[1] + (height - image.height) // 2)


def frame(number, category, title, subtitle, note):
    canvas = Image.new("RGB", (1280, 800), "#0e1427")
    draw = ImageDraw.Draw(canvas)
    for y in range(800):
        shade = int(14 + 12 * (1 - y / 800))
        draw.line((0, y, 1279, y), fill=(shade, shade + 5, shade + 19))
    logo = Image.open(ROOT / "assets" / "icon128.png").convert("RGBA").resize((44, 44), Image.Resampling.LANCZOS)
    canvas.paste(logo, (48, 30), logo)
    draw.text((106, 36), "QudadFlow Translator", font=font(23, True), fill="#f5f8ff")
    draw.text((1060, 41), "EDGE + CHROME / 0.9.0", font=font(12), fill="#a4b2ce")
    draw.line((48, 94, 1232, 94), fill="#2a3554", width=1)
    draw.text((48, 110), f"{number:02d}  /  {category}", font=font(13, True), fill="#71e5d0")
    assert draw.textbbox((0, 0), title, font=font(43, True))[2] <= 1184
    draw.text((46, 138), title, font=font(43, True), fill="#fff")
    draw.text((48, 199), subtitle, font=font(19), fill="#b9c7e1")
    draw.rounded_rectangle((48, 246, 1232, 728), radius=18, fill="#f3f6fc", outline="#6a7894", width=1)
    assert draw.textbbox((0, 0), note, font=font(14))[2] < 1184
    draw.text((48, 753), note, font=font(14), fill="#a8b7d2")
    return canvas, draw


def settings_slide():
    note = "Isolated Edge · Real 0.9.0 UI · No account or local model preconfigured"
    canvas, draw = frame(6, "KEY-FREE DEFAULT", "Translate before configuring AI.",
                         "Ready local model first; MyMemory immediately when it is unavailable.", note)
    capture = Image.open(SOURCES / "settings-default-0.9.0.png").convert("RGB").crop((0, 105, 900, 615))
    capture, at = fit(capture, (64, 260, 835, 714))
    canvas.paste(capture, at)
    draw.line((858, 280, 858, 692), fill="#d9e1f0", width=1)
    points = [
        ("No AI account required", "Translate with the default\nmachine translation mode."),
        ("Local when ready", "You decide whether to\ndownload a browser model."),
        ("Provider limits are clear", "MyMemory quota can be\nshared on a network."),
    ]
    for index, (heading, body) in enumerate(points):
        y = 288 + index * 130
        draw.rounded_rectangle((886, y + 6, 893, y + 13), radius=3, fill="#3b61cb")
        draw.text((908, y), heading, font=font(18, True), fill="#172c4c")
        draw.multiline_text((908, y + 34), body, font=font(15), fill="#526782", spacing=6)
    path = DEST / "qudadflow-06-default-translation.png"
    canvas.save(path, optimize=True)
    return path, note


def chatgpt_slide():
    note = "Optional preview · Separate Windows companion · Plus/Pro documented; Business/Team unconfirmed"
    canvas, draw = frame(7, "OPTIONAL CHATGPT LOGIN", "You choose whether to connect.",
                         "One-time install guidance; the default translator stays available.", note)
    popup = Image.open(SOURCES / "popup-install-offer-0.9.0.png").convert("RGB").crop((0, 0, 320, 265))
    popup, popup_at = fit(popup, (67, 273, 431, 693))
    canvas.paste(popup, popup_at)
    draw.line((450, 282, 450, 692), fill="#d9e1f0", width=1)
    settings = Image.open(SOURCES / "settings-chatgpt-0.9.0.png").convert("RGB").crop((24, 369, 875, 912))
    settings, settings_at = fit(settings, (468, 260, 1215, 714))
    canvas.paste(settings, settings_at)
    path = DEST / "qudadflow-07-chatgpt-preview.png"
    canvas.save(path, optimize=True)
    return path, note


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    for name in ("settings-default-0.9.0.png", "settings-chatgpt-0.9.0.png", "popup-install-offer-0.9.0.png"):
        if not (SOURCES / name).is_file():
            raise FileNotFoundError(SOURCES / name)
    prior = json.loads((PRIOR / "media.json").read_text(encoding="utf-8"))["screenshots"]
    records = []
    for item in prior[:5]:
        source, target = PRIOR / item["file"], DEST / item["file"]
        shutil.copyfile(source, target)
        records.append({
            "file": target.name, "caption_en": item["caption_en"], "caption_zh": item["caption_zh"],
            "capture_version": item["capture_version"], "dimensions": [1280, 800],
            "source": "Historical unchanged feature screenshot from store-0.8.16",
            "sha256": sha(target),
        })
    settings_path, settings_note = settings_slide()
    chatgpt_path, chatgpt_note = chatgpt_slide()
    for target, note, captions in (
        (settings_path, settings_note, ("Default key-free translation and optional local model setup",
                                        "默认免 Key 翻译与可选本地模型准备")),
        (chatgpt_path, chatgpt_note, ("Dismissible ChatGPT preview guidance and separate Windows host",
                                      "可关闭的 ChatGPT 预览引导及独立 Windows 连接程序")),
    ):
        records.append({
            "file": target.name, "caption_en": captions[0], "caption_zh": captions[1],
            "capture_version": "0.9.0", "dimensions": [1280, 800],
            "source": note, "sha256": sha(target),
        })
    sheet = Image.new("RGB", (1280, 1600), "#dce3ef")
    for index, item in enumerate(records):
        image = Image.open(DEST / item["file"]).resize((640, 400), Image.Resampling.LANCZOS)
        sheet.paste(image, ((index % 2) * 640, (index // 2) * 400))
    sheet.save(DEST / "preview.jpg", quality=91)
    (DEST / "media.json").write_text(json.dumps({
        "version": "0.9.0",
        "source": "Current UI captured in isolated Edge; unchanged historical features retain their labeled prior screenshots. Synthetic API examples do not establish provider quality or speed.",
        "edge_upload": [item["file"] for item in records],
        "chrome_upload": [records[index]["file"] for index in (0, 1, 2, 3, 5)],
        "screenshots": records,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(DEST), "screenshots": len(records), "dimensions": "1280x800"}))


if __name__ == "__main__":
    main()
