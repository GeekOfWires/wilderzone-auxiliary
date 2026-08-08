#!/usr/bin/env python3
"""Build the wilderzoneClan vl2 archives.

A .vl2 is a plain PKZIP archive whose internal paths are relative to the
game's mod directory (GameData/<mod>/). This script produces three archives
in a dist/ directory next to this script:

  wilderzoneClanQOL-server.vl2   server-qol/ only
  wilderzoneClanQOL-client.vl2   client-common/ + client-qol/
  wilderzoneClanRC-client.vl2    client-common/ + client-rc/

For the client flavors, files from the flavor directory are layered over the
shared client-common/ directory (by design there are no path collisions:
flavors own settings/transport/sessionGlue, common owns everything else).

Usage:  python build-vl2.py        (or ./build-vl2.sh)
"""

import os
import sys
import zipfile

REPO = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(REPO, "dist")

# arcname source file types that go into the archives
INCLUDE_EXT = {".cs", ".gui", ".rb"}


def add_tree(zf, src_dir):
    """Add every included file under src_dir, arcname relative to src_dir."""
    count = 0
    for dirpath, _dirnames, filenames in os.walk(src_dir):
        for name in sorted(filenames):
            ext = os.path.splitext(name)[1].lower()
            if ext not in INCLUDE_EXT:
                continue
            full = os.path.join(dirpath, name)
            arc = os.path.relpath(full, src_dir).replace(os.sep, "/")
            zf.write(full, arc)
            count += 1
    return count


def build(out_name, layers):
    out_path = os.path.join(OUT_DIR, out_name)
    if os.path.exists(out_path):
        os.remove(out_path)
    total = 0
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for layer in layers:
            src = os.path.join(REPO, layer)
            if not os.path.isdir(src):
                print(f"ERROR: missing layer directory {layer}", file=sys.stderr)
                sys.exit(1)
            n = add_tree(zf, src)
            print(f"  {layer}: {n} files")
            total += n
    print(f"built {out_path} ({total} files)")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    build("wilderzoneClanQOL-server.vl2", ["server-qol"])
    build("wilderzoneClanQOL-client.vl2", ["client-common", "client-qol"])
    build("wilderzoneClanRC-client.vl2", ["client-common", "client-rc"])


if __name__ == "__main__":
    main()
