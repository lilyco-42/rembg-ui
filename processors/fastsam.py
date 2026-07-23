from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image
from ultralytics import FastSAM


class FastSAMProcessor:
    def __init__(
        self,
        model_path: str = "FastSAM-s.pt",
        device: str = "cpu",
    ) -> None:
        self.model = FastSAM(model_path)
        self.device = device

    def segment_by_point(
        self,
        image_path: str | Path,
        x: int,
        y: int,
        conf: float = 0.4,
        iou: float = 0.9,
        imgsz: int = 1024,
    ) -> np.ndarray:
        image_path = Path(image_path)
        if not image_path.exists():
            raise FileNotFoundError(f"图片不存在: {image_path}")

        results = self.model(
            image_path,
            device=self.device,
            conf=conf,
            iou=iou,
            imgsz=imgsz,
            retina_masks=True,
        )

        if not results or len(results) == 0:
            raise RuntimeError("FastSAM 未返回任何检测结果")

        masks_data = results[0].masks
        if masks_data is None or masks_data.data is None or len(masks_data.data) == 0:
            raise RuntimeError("FastSAM 未生成任何 mask")

        orig_h, orig_w = results[0].orig_shape
        if not (0 <= x < orig_w and 0 <= y < orig_h):
            raise ValueError(f"坐标 ({x}, {y}) 超出图片范围 ({orig_w}x{orig_h})")

        mask_tensor = masks_data.data
        masks_np = mask_tensor.cpu().numpy()

        for i in range(masks_np.shape[0]):
            mask = masks_np[i]
            if mask.shape[0] > y and mask.shape[1] > x and mask[y, x] > 0:
                return (mask.astype(np.uint8) * 255)

        raise RuntimeError(f"坐标 ({x}, {y}) 处未命中任何 mask，请尝试调整 conf/iou 参数")

    @staticmethod
    def apply_mask(image: Image.Image, mask: np.ndarray) -> Image.Image:
        image = image.convert("RGBA")
        mask_resized: np.ndarray
        if mask.shape[:2] != (image.height, image.width):
            mask_img = Image.fromarray(mask, mode="L").resize(image.size, Image.NEAREST)
            mask_resized = np.array(mask_img)
        else:
            mask_resized = mask
        image.putalpha(Image.fromarray(mask_resized, mode="L"))
        return image

    def segment_and_apply(
        self,
        image_path: str | Path,
        x: int,
        y: int,
        conf: float = 0.4,
        iou: float = 0.9,
        imgsz: int = 1024,
    ) -> Image.Image:
        mask = self.segment_by_point(image_path, x, y, conf=conf, iou=iou, imgsz=imgsz)
        image = Image.open(image_path)
        return self.apply_mask(image, mask)
