# /// script
# requires-python = ">=3.12"
# dependencies = ["requests", "pillow"]
# ///
"""Generate the mission illustrations once with Muse Image (Meta) and cache them in the repo.

Not used at runtime. Usage:
  uv run tools/illustrations/generate.py [--only id1,id2] [--effort low|medium|high]
                                         [--raw-dir DIR] [--env-file PATH]
Reads META_API_BASE_URL and META_API_KEY from the environment (or --env-file).
Raw generations go to --raw-dir (outside the repo) for review; the final
webp (<= 120 KB, ~800 px) and apps/web/public/illustrations/manifest.json
are written into the repo.
"""

import argparse
import base64
import datetime
import io
import json
import os
import time
from pathlib import Path

import requests
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / "apps" / "web" / "public" / "illustrations"
REF = HERE / "musi-ref.png"
MODEL = "muse-image-1.0"
MAX_BYTES = 120 * 1024
SIZE_PX = 800

STYLE = (
    "Flat vector children's book illustration for kids aged 9 to 12, warm and friendly mood, "
    "soft rounded shapes, thick dark-brown (#78350f) outlines on the main character, "
    "cream/pale-yellow (#fffbeb) background with a few simple soft pastel shapes, clean uncluttered composition, "
    "square format with the scene centered. "
    "Character 'Musi': a round, chubby mascot with a perfectly circular amber-orange (#f59e0b) body, "
    "dark-brown outline, two small round ears on top, two big white eyes with dark pupils, "
    "a small dark-red smile and no arms or legs unless needed for the pose. Keep Musi's design identical to the reference image. "
    "Strictly NO text, NO letters, NO numbers, NO digits anywhere in the image, no logos, no real people. "
    "Any friends are simple cute generic animal cubs or generic cartoon kids in the same flat style."
)


def load_env(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


def generate(base: str, key: str, scene: str, effort: str) -> tuple[bytes, float]:
    ref = base64.b64encode(REF.read_bytes()).decode()
    content = [
        {"type": "input_text", "text": "Reference of the character Musi, keep the exact same design:"},
        {"type": "input_image", "image_url": "data:image/png;base64," + ref},
        {"type": "input_text", "text": f"{STYLE} Scene: {scene}"},
    ]
    body = {
        "model": MODEL,
        "input": [{"role": "user", "content": content}],
        "tools": [{"type": "image_generation", "size": "1024x1024", "output_format": "webp", "reasoning_strength": effort}],
    }
    t = time.time()
    r = requests.post(
        f"{base}/responses", headers={"Authorization": f"Bearer {key}"}, json=body, timeout=300
    )
    dt = time.time() - t
    r.raise_for_status()
    for o in r.json()["output"]:
        if o["type"] == "image_generation_call":
            return base64.b64decode(o["result"]), dt
    raise RuntimeError("no image in response")


def compress(raw: bytes) -> bytes:
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img.thumbnail((SIZE_PX, SIZE_PX), Image.LANCZOS)
    for q in (88, 82, 76, 70, 64, 58, 50):
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=q, method=6)
        if buf.tell() <= MAX_BYTES:
            return buf.getvalue()
    raise RuntimeError("cannot fit under 120 KB")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--effort", default="low", choices=["low", "medium", "high"])
    ap.add_argument("--raw-dir", default=str(Path.cwd() / "illustrations-raw"))
    ap.add_argument("--env-file", default=str(ROOT / ".env"))
    ap.add_argument("--from-raw", action="store_true", help="skip the API; compress existing raw files")
    a = ap.parse_args()

    load_env(Path(a.env_file))
    base = os.environ.get("META_API_BASE_URL", "").rstrip("/")
    key = os.environ.get("META_API_KEY", "")
    if not a.from_raw and not (base and key):
        raise SystemExit("META_API_BASE_URL / META_API_KEY missing")

    items = json.loads((HERE / "manifest.json").read_text())
    only = {s for s in a.only.split(",") if s}
    raw_dir = Path(a.raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    out_manifest = OUT / "manifest.json"
    done = {e["id"]: e for e in json.loads(out_manifest.read_text())} if out_manifest.exists() else {}

    for it in items:
        if only and it["id"] not in only:
            continue
        stamp = time.strftime("%H%M%S")
        if a.from_raw:
            raw = (raw_dir / f"{it['id']}.webp").read_bytes()
        else:
            raw, dt = generate(base, key, it["scene"], a.effort)
            (raw_dir / f"{it['id']}-{stamp}.webp").write_bytes(raw)
            (raw_dir / f"{it['id']}.webp").write_bytes(raw)
            print(f"{it['id']}: {dt:.1f}s, raw {len(raw) // 1024} KB", flush=True)
        final = compress(raw)
        (OUT / it["file"]).write_bytes(final)
        done[it["id"]] = {
            "id": it["id"],
            "file": it["file"],
            "alt": it["alt"],
            "model": MODEL,
            "date": datetime.date.today().isoformat(),
        }
        print(f"  -> {it['file']} {len(final) // 1024} KB")

    order = [i["id"] for i in items]
    out_manifest.write_text(
        json.dumps([done[i] for i in order if i in done], indent=2, ensure_ascii=False) + "\n"
    )


if __name__ == "__main__":
    main()
