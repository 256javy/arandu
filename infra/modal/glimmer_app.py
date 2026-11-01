"""Muse Glimmer (Meta open weights, Apache 2.0) behind an OpenAI-compatible vLLM server on Modal.

Used for the eval harness's simulated kids and an optional offline-school tutor ("Musi offline").
Commands and costs: infra/modal/README.md.

    uvx modal run infra/modal/glimmer_app.py::download_weights   # once, CPU only
    uvx modal deploy infra/modal/glimmer_app.py

Cost (Modal list prices, check modal.com/pricing): H100 ~US$3.95/h, A100-80GB ~US$2.50/h, billed per
second while a container is up. Cold start (~60 GB from the Volume + vLLM warm-up) takes ~3-6 min; with
scaledown_window=5 min one eval run of 30-60 min costs ~US$3-5. Idle = US$0.
"""

from __future__ import annotations

import os
import subprocess

import modal

MODEL_ID = "meta-models/Muse-Glimmer-30B"  # bf16 safetensors, ~60 GB, not gated
SERVED_NAME = "muse-glimmer"
PORT = 8000
MINUTES = 60
HF_CACHE = "/root/.cache/huggingface"

hf_cache = modal.Volume.from_name("arandu-glimmer-hf-cache", create_if_missing=True)
vllm_cache = modal.Volume.from_name("arandu-glimmer-vllm-cache", create_if_missing=True)

# Official image for this model (CUDA 13.0); its entrypoint is `vllm serve`, cleared so Modal can run Python.
vllm_image = (
    modal.Image.from_registry("vllm/vllm-openai:muse-glimmer")
    .entrypoint([])
    .env({"HF_XET_HIGH_PERFORMANCE": "1", "HF_HUB_OFFLINE": "1"})  # weights come only from the Volume
)
download_image = modal.Image.debian_slim(python_version="3.12").uv_pip_install("huggingface_hub[hf_xet]>=0.30")

app = modal.App("arandu-glimmer")


@app.function(image=download_image, volumes={HF_CACHE: hf_cache}, timeout=60 * MINUTES)
def download_weights() -> None:
    """Fills the Volume once so cold starts never touch the Hub. No GPU, cents of CPU time."""
    from huggingface_hub import snapshot_download

    path = snapshot_download(MODEL_ID, cache_dir=f"{HF_CACHE}/hub")
    hf_cache.commit()
    print(f"weights at {path}")


@app.server(
    image=vllm_image,
    # bf16 needs ~72 GB of VRAM; first available wins. GLIMMER_GPU overrides at deploy time (e.g. "A100-80GB":
    # Modal refuses H100 functions until the workspace has a payment method, even with credits).
    gpu=os.environ.get("GLIMMER_GPU", "H100,A100-80GB").split(","),
    secrets=[modal.Secret.from_name("arandu-glimmer")],  # GLIMMER_API_KEY
    volumes={HF_CACHE: hf_cache, "/root/.cache/vllm": vllm_cache},
    port=PORT,
    startup_timeout=20 * MINUTES,
    scaledown_window=5 * MINUTES,  # idle GPU is the main cost; keep short
    max_containers=1,  # hard cap on spend
    target_concurrency=32,
    unauthenticated=True,  # Modal proxy auth off; vLLM checks `Authorization: Bearer $GLIMMER_API_KEY`
)
class Server:
    @modal.enter()
    def start(self) -> None:
        import os

        cmd = [
            "vllm", "serve", MODEL_ID,
            "--served-model-name", SERVED_NAME,
            "--host", "0.0.0.0", "--port", str(PORT),
            "--api-key", os.environ["GLIMMER_API_KEY"],  # every /v1 route requires the bearer token
            "--tensor-parallel-size", "1",
            "--max-model-len", "16384",
            "--gpu-memory-utilization", "0.92",
            "--enable-auto-tool-choice",
            "--tool-call-parser", "muse_glimmer",
            "--reasoning-parser", "muse_glimmer",
            "--generation-config", "auto",
        ]
        print(" ".join(c if c != os.environ["GLIMMER_API_KEY"] else "***" for c in cmd))
        self.process = subprocess.Popen(cmd)

    @modal.exit()
    def stop(self) -> None:
        self.process.terminate()
