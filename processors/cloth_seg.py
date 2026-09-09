from pathlib import Path

import numpy as np
from PIL import Image


class ClothSegProcessor:
    CATEGORIES = ["upper", "lower", "full"]

    def __init__(self, session=None) -> None:
        if session is None:
            from rembg import new_session

            session = new_session("u2net_cloth_seg")
        self.session = session

    def segment_image(self, img: Image.Image) -> dict[str, Image.Image]:
        img = img.convert("RGB")
        masks = self.session.predict(img)
        result: dict[str, Image.Image] = {}
        for cat, mask_img in zip(self.CATEGORIES, masks):
            mask_np = np.array(mask_img)
            if mask_np.ndim == 3:
                mask_np = mask_np[:, :, 0]
            binary = (mask_np > 0).astype(np.uint8) * 255
            if int(binary.max()) == 0:
                continue
            rgba = img.copy().convert("RGBA")
            rgba.putalpha(Image.fromarray(binary, mode="L"))
            result[cat] = rgba
        return result

    def segment(self, image_path: str | Path) -> dict[str, Image.Image]:
        image_path = Path(image_path)
        if not image_path.exists():
            raise FileNotFoundError(f"图片不存在: {image_path}")
        img = Image.open(image_path).convert("RGB")
        return self.segment_image(img)

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
