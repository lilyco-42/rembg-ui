"""gpu_providers 分支选择逻辑单测（不加载真实 ORT / 不触发 os.execv）。"""
import os
import tempfile
import unittest
from unittest import mock

import gpu_providers


class FakeSessionFactory:
    def __init__(self, fail_for=()):
        self.fail_for = set(fail_for)
        self.calls = []
        self.ok = object()

    def __call__(self, model_bytes, providers, config_entries=None):
        first = providers[0]
        name = first[0] if isinstance(first, (tuple, list)) else first
        self.calls.append((model_bytes, providers, config_entries))
        if name in self.fail_for:
            raise RuntimeError("probe failed: " + name)
        return self.ok


class DetectProvidersTest(unittest.TestCase):
    def test_darwin_coreml(self):
        f = FakeSessionFactory()
        out = gpu_providers.detect_providers(
            platform="darwin",
            available=["CoreMLExecutionProvider", "CPUExecutionProvider"],
            session_factory=f,
            preload_cuda=lambda: None,
        )
        self.assertEqual(out, ["CoreMLExecutionProvider", "CPUExecutionProvider"])
        self.assertEqual(f.calls, [])  # CoreML 沿用原行为，不建探测会话

    def test_darwin_cpu_fallback(self):
        out = gpu_providers.detect_providers(
            platform="darwin", available=["CPUExecutionProvider"],
            session_factory=FakeSessionFactory(), preload_cuda=lambda: None,
        )
        self.assertEqual(out, ["CPUExecutionProvider"])

    def test_migraphx_selected_with_cache(self):
        with tempfile.TemporaryDirectory() as d:
            with mock.patch.dict(os.environ, {"REMBG_MIGRAPHX_CACHE_DIR": d}):
                f = FakeSessionFactory()
                out = gpu_providers.detect_providers(
                    platform="linux",
                    available=["MIGraphXExecutionProvider", "CPUExecutionProvider"],
                    session_factory=f, preload_cuda=lambda: None,
                )
            self.assertEqual(len(out), 2)
            self.assertIsInstance(out[0], tuple)
            self.assertEqual(out[0][0], "MIGraphXExecutionProvider")
            self.assertEqual(out[0][1].get("migraphx_model_cache_dir"), d)
            self.assertEqual(out[1], "CPUExecutionProvider")
            self.assertEqual(len(f.calls), 1)
            self.assertEqual(f.calls[0][1], [out[0]])

    def test_migraphx_without_cache(self):
        with mock.patch.object(gpu_providers, "migraphx_cache_dir", return_value=None):
            f = FakeSessionFactory()
            out = gpu_providers.detect_providers(
                platform="linux",
                available=["MIGraphXExecutionProvider", "CPUExecutionProvider"],
                session_factory=f, preload_cuda=lambda: None,
            )
        self.assertEqual(out[0], ("MIGraphXExecutionProvider", {}))

    def test_migraphx_probe_fails_falls_to_cpu(self):
        f = FakeSessionFactory(fail_for=["MIGraphXExecutionProvider"])
        out = gpu_providers.detect_providers(
            platform="linux",
            available=["MIGraphXExecutionProvider", "CPUExecutionProvider"],
            session_factory=f, preload_cuda=lambda: None,
        )
        self.assertEqual(out, ["CPUExecutionProvider"])
        self.assertEqual(len(f.calls), 1)

    def test_migraphx_probe_fails_falls_to_cuda(self):
        f = FakeSessionFactory(fail_for=["MIGraphXExecutionProvider"])
        out = gpu_providers.detect_providers(
            platform="linux",
            available=["MIGraphXExecutionProvider", "CUDAExecutionProvider", "CPUExecutionProvider"],
            session_factory=f, preload_cuda=lambda: None,
        )
        self.assertEqual(out, ["CUDAExecutionProvider", "CPUExecutionProvider"])

    def test_cuda_selected_when_no_migraphx(self):
        f = FakeSessionFactory()
        out = gpu_providers.detect_providers(
            platform="linux",
            available=["TensorrtExecutionProvider", "CUDAExecutionProvider", "CPUExecutionProvider"],
            session_factory=f, preload_cuda=lambda: None,
        )
        self.assertEqual(out, ["CUDAExecutionProvider", "CPUExecutionProvider"])
        self.assertEqual(f.calls[0][1], ["CUDAExecutionProvider"])
        self.assertIn(("session.use_env_allocators", "1"), f.calls[0][2])

    def test_cuda_probe_fails_cpu(self):
        f = FakeSessionFactory(fail_for=["CUDAExecutionProvider"])
        out = gpu_providers.detect_providers(
            platform="linux", available=["CUDAExecutionProvider", "CPUExecutionProvider"],
            session_factory=f, preload_cuda=lambda: None,
        )
        self.assertEqual(out, ["CPUExecutionProvider"])

    def test_no_gpu_providers(self):
        out = gpu_providers.detect_providers(
            platform="linux", available=["CPUExecutionProvider"],
            session_factory=FakeSessionFactory(), preload_cuda=lambda: None,
        )
        self.assertEqual(out, ["CPUExecutionProvider"])

    def test_ort_import_error_falls_back_to_cpu(self):
        import builtins

        real_import = builtins.__import__

        def fake(name, *args, **kwargs):
            if name == "onnxruntime":
                raise ImportError("no onnxruntime")
            return real_import(name, *args, **kwargs)

        with mock.patch("builtins.__import__", side_effect=fake):
            out = gpu_providers.detect_providers(platform="linux")
        self.assertEqual(out, ["CPUExecutionProvider"])


class MigraphxCacheDirTest(unittest.TestCase):
    def test_env_override_creates_dir(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "nested", "cache")
            with mock.patch.dict(os.environ, {"REMBG_MIGRAPHX_CACHE_DIR": p}):
                self.assertEqual(gpu_providers.migraphx_cache_dir(), p)
            self.assertTrue(os.path.isdir(p))

    def test_default_path(self):
        with mock.patch.dict(os.environ, {}, clear=True), \
                mock.patch.object(gpu_providers.os, "makedirs") as mk, \
                mock.patch.object(gpu_providers.os.path, "expanduser", return_value="/home/fake"):
            p = gpu_providers.migraphx_cache_dir()
        self.assertEqual(p, os.path.join("/home/fake", ".cache", "rembg-ui-migraphx"))
        mk.assert_called_once()

    def test_unwritable_cache_returns_none(self):
        with mock.patch.dict(os.environ, {"REMBG_MIGRAPHX_CACHE_DIR": "/proc/nope"}), \
                mock.patch.object(gpu_providers.os, "makedirs", side_effect=OSError):
            self.assertIsNone(gpu_providers.migraphx_cache_dir())


if __name__ == "__main__":
    unittest.main()
