"""Local static preview with explicit MIME types, including on Windows."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript",
        ".wasm": "application/wasm",
    }


if __name__ == "__main__":
    root = Path(__file__).resolve().parent / "dist"
    print("WASM preview: http://127.0.0.1:8056/", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8056), partial(Handler, directory=str(root))).serve_forever()
