#!/bin/bash
set -e

OUTDIR="release"

echo "Building frontend..."
bun run build

echo "Building executables..."
mkdir -p "$OUTDIR"

bun build --compile --target=bun-linux-x64 --minify --sourcemap --outfile "$OUTDIR/mech-builder-linux" src/index.ts

bun build --compile --target=bun-windows-x64 --minify --sourcemap --outfile "$OUTDIR/mech-builder-win.exe" src/index.ts

echo "Done. Executables are in $OUTDIR/:"
ls -lh "$OUTDIR"