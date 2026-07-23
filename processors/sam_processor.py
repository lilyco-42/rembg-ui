from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image
from ultralytics import SAM
from ultralytics.models.sam import Predictor as SAMPredictor
from ultralytics.utils import DEFAULT_CFG


@dataclass
class MaskCandidate:
    mask: np.ndarray
    score: float
    area_pct: float
    label: str


@dataclass
class SegmentResult:
    candidates: list[MaskCandidate] = field(default_factory=list)

    @property
    def best(self) -> Optional[MaskCandidate]:
        return self.candidates[0] if self.candidates else None


class MobileSAMProcessor:
    def __init__(self, model_path: str = "mobile_sam.pt", device: str = "cpu") -> None:
        self.model = SAM(model_path)
        self.device = device
        self._predictor: Optional[SAMPredictor] = None
        self._orig_size: tuple[int, int] = (0, 0)
        self._im_tensor = None

    def _get_predictor(self) -> SAMPredictor:
        if self._predictor is None:
            overrides = dict(device=self.device, retina_masks=True)
            self._predictor = SAMPredictor(DEFAULT_CFG, overrides=overrides)
            self._predictor.setup_model(self.model.model)
        return self._predictor

    def load_image(self, image_path: str | Path | np.ndarray) -> None:
        predictor = self._get_predictor()
        if isinstance(image_path, np.ndarray):
            self._orig_size = (image_path.shape[1], image_path.shape[0])
            predictor.set_image(image_path)
        else:
            image_path = Path(image_path)
            if not image_path.exists():
                raise FileNotFoundError(f"图片不存在: {image_path}")
            predictor.set_image(str(image_path))
            with Image.open(image_path) as img:
                self._orig_size = img.size
        for batch in predictor.dataset:
            predictor.batch = batch
            self._im_tensor = predictor.preprocess(batch[1])
            break

    def _get_im_tensor(self):
        return self._im_tensor

    @staticmethod
    def _generate_label(mask: np.ndarray, orig_w: int, orig_h: int) -> str:
        ys, xs = np.where(mask > 0)
        if len(ys) == 0:
            return "空区域"

        cy = float(ys.mean()) / orig_h
        area = len(ys) / (orig_h * orig_w)

        parts = []
        if cy < 0.25:
            parts.append("顶部")
        elif cy < 0.45:
            parts.append("上部")
        elif cy < 0.65:
            parts.append("中部")
        else:
            parts.append("下部")

        if area < 0.05:
            parts.append("小物体")
        elif area < 0.15:
            parts.append("物体")
        elif area < 0.30:
            parts.append("较大区域")
        else:
            parts.append("大面积")

        return " ".join(parts)

    def segment_by_point(self, x: int, y: int) -> np.ndarray:
        predictor = self._get_predictor()
        im = self._get_im_tensor()
        orig_w, orig_h = self._orig_size

        masks, scores = predictor.prompt_inference(
            im,
            points=np.array([[x, y]]),
            labels=np.array([1]),
            multimask_output=False,
        )

        if masks.shape[0] == 0:
            raise RuntimeError(f"坐标 ({x}, {y}) 处未生成 mask")

        mask_bool = (masks[0] > 0).cpu().numpy()
        mask_img = Image.fromarray(mask_bool.astype(np.uint8) * 255, mode="L")
        mask_img = mask_img.resize((orig_w, orig_h), Image.NEAREST)
        return np.array(mask_img)

    def segment_all_candidates(self, x: int, y: int) -> SegmentResult:
        return self.segment_with_points([(x, y)], [1])

    def segment_with_points(
        self,
        points: list[tuple[int, int]],
        labels: list[int],
    ) -> SegmentResult:
        predictor = self._get_predictor()
        im = self._get_im_tensor()
        orig_w, orig_h = self._orig_size

        masks, scores = predictor.prompt_inference(
            im,
            points=np.array(points),
            labels=np.array(labels),
            multimask_output=True,
        )

        result = SegmentResult()
        for i in range(masks.shape[0]):
            mask_bool = (masks[i] > 0).cpu().numpy()
            mask_img = Image.fromarray(mask_bool.astype(np.uint8) * 255, mode="L")
            mask_img = mask_img.resize((orig_w, orig_h), Image.NEAREST)
            mask_resized = np.array(mask_img) > 0

            area_pct = mask_resized.sum() / mask_resized.size * 100
            mask_255 = mask_resized.astype(np.uint8) * 255
            label = self._generate_label(mask_resized, orig_w, orig_h)
            score = float(scores[i].item()) if hasattr(scores[i], "item") else float(scores[i])
            result.candidates.append(MaskCandidate(
                mask=mask_255,
                score=score,
                area_pct=area_pct,
                label=label,
            ))

        result.candidates.sort(key=lambda c: c.score, reverse=True)
        return result

    def auto_segment(self, image_path: str | Path, max_det: int = 255) -> SegmentResult:
        result = self.model.predict(
            str(image_path), max_det=max_det, verbose=False, device=self.device
        )
        self._predictor = None
        self.load_image(image_path)  # re-init predictor for later point queries
        r = result[0]
        orig_h, orig_w = r.orig_shape

        masks_tensor = r.masks.data
        n = masks_tensor.shape[0]

        result = SegmentResult()
        for i in range(n):
            mask_bool = (masks_tensor[i] > 0).cpu().numpy()
            h, w = mask_bool.shape
            if (h, w) != (orig_h, orig_w):
                mask_img = Image.fromarray(mask_bool.astype(np.uint8) * 255, mode="L")
                mask_img = mask_img.resize((orig_w, orig_h), Image.NEAREST)
                mask_bool = np.array(mask_img, dtype=bool)
            area_pct = mask_bool.sum() / (orig_h * orig_w) * 100
            mask_255 = mask_bool.astype(np.uint8) * 255
            label = self._generate_label(mask_bool, orig_w, orig_h)
            result.candidates.append(MaskCandidate(
                mask=mask_255, score=round(area_pct / 100.0, 3),
                area_pct=round(area_pct, 1), label=label,
            ))

        result.candidates.sort(key=lambda c: c.area_pct, reverse=True)
        return result

    @staticmethod
    def apply_mask(image: Image.Image, mask: np.ndarray) -> Image.Image:
        image = image.convert("RGBA")
        if mask.shape[:2] != (image.height, image.width):
            mask_img = Image.fromarray(mask, mode="L").resize(image.size, Image.NEAREST)
            mask = np.array(mask_img)
        image.putalpha(Image.fromarray(mask, mode="L"))
        return image

    def segment_and_apply(self, image_path: str | Path, x: int, y: int) -> Image.Image:
        self.load_image(image_path)
        mask = self.segment_by_point(x, y)
        image = Image.open(image_path)
        return self.apply_mask(image, mask)
