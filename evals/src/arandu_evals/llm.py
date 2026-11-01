"""OpenAI-compatible LLM clients (Meta Model API, Fireworks) with per-call usage."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Protocol

from openai import AsyncOpenAI


@dataclass(frozen=True)
class Provider:
    name: str
    base_url: str
    key_env: str
    model: str


PROVIDERS: dict[str, Provider] = {
    "meta": Provider(
        "meta",
        os.environ.get("META_API_BASE_URL") or "https://api.meta.ai/v1",
        "META_API_KEY",
        os.environ.get("META_MODEL") or "muse-spark-1.3",
    ),
    "fireworks": Provider(
        "fireworks",
        "https://api.fireworks.ai/inference/v1",
        "FIREWORKS_API_KEY",
        "accounts/fireworks/models/muse-spark-open",
    ),
}

ROLES = ("kid", "tutor", "judge")


@dataclass
class Completion:
    text: str
    prompt_tokens: int = 0
    completion_tokens: int = 0


class LLM(Protocol):
    provider: str
    model: str

    async def complete(self, messages: list[dict], *, temperature: float) -> Completion: ...


class EmptyResponseError(RuntimeError):
    pass


class OpenAICompatLLM:
    """Muse Spark reasons before answering: reasoning tokens count against max_tokens,
    so the budget must be generous or the content comes back null."""

    def __init__(self, provider: Provider, *, max_tokens: int = 2000, reasoning_effort: str = "low",
                 empty_retries: int = 2):
        key = os.environ.get(provider.key_env)
        if not key:
            raise RuntimeError(f"{provider.key_env} is not set")
        self.provider = provider.name
        self.model = provider.model
        self._client = AsyncOpenAI(base_url=provider.base_url, api_key=key, timeout=120, max_retries=4)
        self._max_tokens = max_tokens
        self._effort = reasoning_effort
        self._empty_retries = empty_retries

    async def complete(self, messages: list[dict], *, temperature: float) -> Completion:
        prompt = completion = 0
        for attempt in range(self._empty_retries + 1):
            res = await self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=self._max_tokens,
                reasoning_effort=self._effort,
            )
            if res.usage:
                prompt += res.usage.prompt_tokens or 0
                completion += res.usage.completion_tokens or 0
            content = res.choices[0].message.content if res.choices else None
            if content and content.strip():
                return Completion(content.strip(), prompt, completion)
            await asyncio.sleep(1 + attempt)
        raise EmptyResponseError(f"{self.provider}/{self.model} returned empty content")


async def probe(provider_name: str) -> str | None:
    """One tiny call. Returns None if the provider works, else the reason it does not."""
    provider = PROVIDERS[provider_name]
    try:
        llm = OpenAICompatLLM(provider, empty_retries=0)
        await llm.complete([{"role": "user", "content": "Decí hola."}], temperature=0)
        return None
    except Exception as e:  # noqa: BLE001 - any failure means "not usable"
        return f"{type(e).__name__}: {str(e)[:200]}"


@dataclass(frozen=True)
class RoleConfig:
    provider: str
    model: str


async def resolve_roles(requested: dict[str, str]) -> tuple[dict[str, RoleConfig], list[str]]:
    """Maps each role to a provider. "auto" means Fireworks if it answers, else Meta."""
    notes: list[str] = []
    resolved: dict[str, RoleConfig] = {}
    fireworks_error: str | None | bool = False  # False = not probed yet
    for role in ROLES:
        name = requested.get(role, "meta")
        if name == "auto":
            if fireworks_error is False:
                fireworks_error = await probe("fireworks")
            if fireworks_error is None:
                name = "fireworks"
            else:
                notes.append(f"{role}: Fireworks unavailable ({fireworks_error}); using Meta")
                name = "meta"
        if name not in PROVIDERS:
            raise ValueError(f"unknown provider {name!r} for role {role}")
        resolved[role] = RoleConfig(name, PROVIDERS[name].model)
    return resolved, notes


def make_clients(roles: dict[str, RoleConfig], efforts: dict[str, str] | None = None) -> dict[str, LLM]:
    """`efforts` overrides reasoning_effort per role (default "low"), like the API's per-role settings."""
    efforts = efforts or {}
    cache: dict[tuple[str, str], LLM] = {}
    out: dict[str, LLM] = {}
    for role, cfg in roles.items():
        key = (cfg.provider, efforts.get(role, "low"))
        if key not in cache:
            cache[key] = OpenAICompatLLM(PROVIDERS[cfg.provider], reasoning_effort=key[1])
        out[role] = cache[key]
    return out
