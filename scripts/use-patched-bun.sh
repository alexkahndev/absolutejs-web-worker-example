#!/bin/bash
PATCHED_BUN="$HOME/alex/bun-transpiler-patch/build/release/bun"

if [ ! -f "$PATCHED_BUN" ]; then
    echo "Patched Bun not found at $PATCHED_BUN"
    echo "Build it: cd ~/alex/bun-transpiler-patch && bun run build:release"
    exit 1
fi

if [ $# -gt 0 ]; then
    echo "Using patched Bun: $("$PATCHED_BUN" --version) (reactFastRefresh enabled)" >&2
    PATH="$(dirname "$PATCHED_BUN"):$PATH" exec "$@"
else
    export PATH="$(dirname "$PATCHED_BUN"):$PATH"
    echo "Using patched Bun: $($PATCHED_BUN --version)"
fi
