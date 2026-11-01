# Modal apps

- `glimmer_app.py`: [Muse Glimmer](https://huggingface.co/meta-models/Muse-Glimmer-30B) (Meta open weights,
  Apache 2.0, 30B dense, text + image in) served by vLLM as an OpenAI-compatible API. Used for the eval
  harness's simulated kids and an optional offline-school tutor.
- `evals_app.py`: fans the eval harness (`evals/`) out as Modal function calls.

## Glimmer: one-time setup

```bash
uvx modal token new                                   # browser login, writes ~/.modal.toml
uvx modal secret create arandu-glimmer GLIMMER_API_KEY="$(openssl rand -hex 24)"
uvx modal run infra/modal/glimmer_app.py::download_weights   # ~60 GB to the Volume, CPU only
```

Keep the generated key somewhere local (`export GLIMMER_API_KEY=...` in your untracked `.env`); Modal does
not show secret values again. The weights are not gated, so no `HF_TOKEN` is needed.

## Deploy, smoke test, stop

```bash
uvx modal deploy infra/modal/glimmer_app.py           # prints the server URL
export GLIMMER_BASE_URL=https://<url-printed-by-deploy>/v1

curl -s "$GLIMMER_BASE_URL/models" -H "Authorization: Bearer $GLIMMER_API_KEY"     # first call: cold start, minutes
curl -s "$GLIMMER_BASE_URL/chat/completions" -H "Authorization: Bearer $GLIMMER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"muse-glimmer","messages":[{"role":"user","content":"¿Cuánto es 1/2 + 1/4?"}],"max_tokens":400}'
curl -s -o /dev/null -w '%{http_code}\n' "$GLIMMER_BASE_URL/models"                  # expect 401 without the key

uvx modal app stop arandu-glimmer                     # stop serving (no charges either way when idle)
uvx modal volume delete arandu-glimmer-hf-cache       # optional: drop the cached weights
uvx modal volume delete arandu-glimmer-vllm-cache
```

## Evals with Glimmer as the simulated kid

Locally (the tutor and judge stay on the Meta Model API):

```bash
export GLIMMER_BASE_URL=... GLIMMER_API_KEY=... META_API_KEY=...
uv --directory evals run arandu-evals run --repeats 3 --kid-provider glimmer
```

On Modal (`GLIMMER_BASE_URL` is read locally and the key comes from the `arandu-glimmer` secret):

```bash
GLIMMER_BASE_URL=... uv --directory evals run --extra modal modal run ../infra/modal/evals_app.py \
  --repeats 3 --kid-provider glimmer
```

`--tutor-provider glimmer` runs the tutor on Glimmer as well ("Musi offline"). The API can do the same with
`META_API_BASE_URL=$GLIMMER_BASE_URL META_MODEL=muse-glimmer META_API_KEY=$GLIMMER_API_KEY`.

## Cost

Billed per second while a container runs; idle is free. H100 is about US$3.95/h and A100-80GB about
US$2.50/h (check modal.com/pricing). A cold start (weights from the Volume plus vLLM warm-up) takes about
3-6 minutes; the container stops after 5 idle minutes and `max_containers=1` caps parallel spend. An eval run
of 30-60 minutes costs roughly US$3-5; budget US$10-20 for setup, smoke tests and a few runs.

## License

Muse Glimmer weights: Apache 2.0 (model card). vLLM image `vllm/vllm-openai:muse-glimmer`: Apache 2.0.
