from pathlib import Path

import numpy as np
from PIL import Image

from rembg import new_session


class ClothSegProcessor:
    CATEGORIES = ["upper", "lower", "full"]

    def __init__(self) -> None:
        self.session = new_session("u2net_cloth_seg")

    def segment(self, image_path: str | Path) -> dict[str, Image.Image]:
        image_path = Path(image_path)
        if not image_path.exists():
            raise FileNotFoundError(f"图片不存在: {image_path}")

        img = Image.open(image_path).convert("RGB")
        masks = self.session.predict(img)

        result: dict[str, Image.Image] = {}
        for cat, mask_img in zip(self.CATEGORIES, masks):
            mask_np = np.array(mask_img)
            binary = (mask_np > 0).astype(np.uint8) * 255
            rgba = img.copy().convert("RGBA")
            rgba.putalpha(Image.fromarray(binary, mode="L"))
            result[cat] = rgba

        return result

    def segment_and_save(
        self,
        image_path: str | Path,
        output_dir: str | Path = ".",
    ) -> dict[str, Path]:
        image_path = Path(image_path)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        results = self.segment(image_path)
        saved: dict[str, Path] = {}
        stem = image_path.stem
        for cat, img in results.items():
            out_path = output_dir / f"{stem}_{cat}.png"
            img.save(str(out_path))
            saved[cat] = out_path
        return saved
