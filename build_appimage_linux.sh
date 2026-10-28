#!/usr/bin/env bash
# Wrap an existing Nuitka --standalone tree as a type-2 AppImage.
# Build the Nuitka dist first, then run this script on Linux x86_64.
set -euo pipefail
cd "$(dirname "$0")"
source_dir="${1:-dist/rembg-ui.dist}"
output="${2:-dist/Rembg-UI-linux-x86_64.AppImage}"
test -d "$source_dir" || { echo "Missing Nuitka dist: $source_dir" >&2; exit 1; }
source_dir="$(realpath "$source_dir")"
output="$(realpath -m "$output")"
bin=""
for candidate in rembg-ui rembg-ui.bin; do
  if [[ -x "$source_dir/$candidate" ]]; then bin="$candidate"; break; fi
done
[[ -n "$bin" ]] || { echo "Missing executable rembg-ui(.bin) in $source_dir" >&2; exit 1; }

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
appdir="$work_dir/RembgStudio.AppDir"
mkdir -p "$appdir/usr/lib/rembg-ui"
cp -a "$source_dir/." "$appdir/usr/lib/rembg-ui/"
cat > "$appdir/AppRun" <<EOF
#!/usr/bin/env bash
set -e
HERE="\$(cd "\$(dirname "\$(readlink -f "\$0")")" && pwd)"
cd "\$HERE/usr/lib/rembg-ui"
exec "\$HERE/usr/lib/rembg-ui/$bin" "\$@"
EOF
chmod +x "$appdir/AppRun"
cat > "$appdir/rembg-studio.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Rembg Studio
Comment=Offline AI background remover
Exec=AppRun
Icon=rembg-studio
Categories=Graphics;2DGraphics;RasterGraphics;
Terminal=false
StartupNotify=true
EOF
cat > "$appdir/rembg-studio.svg" <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
 <rect width="256" height="256" rx="48" fill="#1a1a2e"/>
 <rect x="40" y="42" width="176" height="172" rx="24" fill="#e94560"/>
 <path d="M60 182L105 116l35 36 31-28 25 58Z" fill="#fff"/>
 <circle cx="165" cy="92" r="18" fill="#fff"/>
</svg>
EOF
# Ensure expected AppDir toplevel icon and desktop entries exist.
[[ -f "$appdir/rembg-studio.desktop" && -f "$appdir/rembg-studio.svg" ]]
mkdir -p "$(dirname "$output")"
appimagetool_bin="${APPIMAGETOOL:-appimagetool}"
command -v "$appimagetool_bin" >/dev/null 2>&1 || { echo "appimagetool not found; set APPIMAGETOOL or install it" >&2; exit 1; }
ARCH=x86_64 "$appimagetool_bin" "$appdir" "$output"
chmod +x "$output"
file "$output"
echo "[OK] AppImage built: $output"
