import io
import unittest

from PIL import Image

from product_export import compose_product


class ProductExportTests(unittest.TestCase):
    def fixture(self):
        image = Image.new("RGBA", (400, 300))
        image.paste((220, 20, 40, 255), (100, 100, 300, 200))
        data = io.BytesIO()
        image.save(data, "PNG")
        return data.getvalue()

    def test_subject_bounds_centered_with_margin(self):
        result = Image.open(io.BytesIO(compose_product(self.fixture(), 800, 10, "transparent", "png")))
        self.assertEqual(result.size, (800, 800))
        self.assertEqual(result.getchannel("A").getbbox(), (80, 240, 720, 560))

    def test_opaque_formats_background(self):
        for fmt in ("png", "jpeg", "webp"):
            with self.subTest(fmt=fmt):
                result = Image.open(io.BytesIO(compose_product(self.fixture(), 1200, 20, "white", fmt)))
                self.assertEqual(result.size, (1200, 1200))
                self.assertEqual(result.convert("RGB").getpixel((0, 0)), (255, 255, 255))
                self.assertEqual(result.format.lower(), fmt)

    def test_invalid_combinations(self):
        for args in ((99999, 10, "white", "png"), (800, 99, "white", "png"), (800, 10, "transparent", "jpeg")):
            with self.subTest(args=args), self.assertRaises(ValueError):
                compose_product(self.fixture(), *args)

    def test_empty_subject_rejected(self):
        data = io.BytesIO()
        Image.new("RGBA", (20, 20)).save(data, "PNG")
        with self.assertRaisesRegex(ValueError, "主体"):
            compose_product(data.getvalue(), 800, 10, "white", "png")


if __name__ == "__main__":
    unittest.main()
