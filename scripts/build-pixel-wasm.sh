#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/src/wasm/pixel.rs"
out="$root/src/wasm/pixel.wasm"
rustc --edition 2021 --target wasm32-unknown-unknown -O \
  -C lto \
  -C opt-level=3 \
  -C panic=abort \
  -C strip=symbols \
  --crate-type cdylib \
  -o "$out" "$src"
echo "wrote $out ($(wc -c < "$out") bytes)"
