"""Deterministic product-photo composition, independent of inference models."""
import io

from PIL import Image, ImageOps


def validate_product_settings(size: int, margin: int, background: str, fmt: str) -> None:
    if size not in (800, 1200, 1600, 2000):
        raise ValueError("画布尺寸须为 800、1200、1600 或 2000")
    if not 0 <= margin <= 30:
        raise ValueError("留白须在 0–30% 之间")
    if background not in ("white", "transparent", "gray") or fmt not in ("png", "jpeg", "webp"):
        raise ValueError("不支持的背景或格式")
    if background == "transparent" and fmt == "jpeg":
        raise ValueError("透明背景请选择 PNG 或 WebP")


def compose_product(data: bytes, size: int, margin: int, background: str, fmt: str) -> bytes:
    validate_product_settings(size, margin, background, fmt)
    with Image.open(io.BytesIO(data)) as source:
        image = ImageOps.exif_transpose(source).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("未检测到商品主体，请更换模型或手动修图")
    subject = image.crop(bounds)
    available = size - 2 * round(size * margin / 100)
    scale = min(available / subject.width, available / subject.height)
    subject = subject.resize((max(1, round(subject.width * scale)), max(1, round(subject.height * scale))), Image.Resampling.LANCZOS)
    colors = {"white": (255, 255, 255, 255), "gray": (245, 245, 245, 255), "transparent": (0, 0, 0, 0)}
    canvas = Image.new("RGBA", (size, size), colors[background])
    canvas.alpha_composite(subject, ((size - subject.width) // 2, (size - subject.height) // 2))
    if fmt == "jpeg":
        canvas = canvas.convert("RGB")
    output = io.BytesIO()
    canvas.save(output, format=fmt.upper(), **({"quality": 95} if fmt != "png" else {}))
    return output.getvalue()
