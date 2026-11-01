import pytest
from arandu_evals import llm
from arandu_evals.cli import parser
from arandu_evals.llm import GLIMMER_DEFAULT_MODEL, OpenAICompatLLM, RoleConfig, build_providers, make_clients


def test_meta_defaults_unchanged():
    p = build_providers({})
    assert p["meta"].base_url == "https://api.meta.ai/v1"
    assert p["meta"].model == "muse-spark-1.3"
    assert p["meta"].key_env == "META_API_KEY"


def test_glimmer_from_env():
    p = build_providers({"GLIMMER_BASE_URL": "https://x--arandu-glimmer.modal.run/v1/", "GLIMMER_MODEL": "m"})
    g = p["glimmer"]
    assert g.base_url == "https://x--arandu-glimmer.modal.run/v1"
    assert g.model == "m"
    assert g.key_env == "GLIMMER_API_KEY"


def test_glimmer_default_model_matches_served_name():
    assert build_providers({})["glimmer"].model == GLIMMER_DEFAULT_MODEL == "muse-glimmer"


def test_glimmer_without_base_url_fails_clearly(monkeypatch):
    monkeypatch.setenv("GLIMMER_API_KEY", "k")
    with pytest.raises(RuntimeError, match="GLIMMER_BASE_URL"):
        OpenAICompatLLM(build_providers({})["glimmer"])


def test_glimmer_without_key_fails(monkeypatch):
    monkeypatch.delenv("GLIMMER_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="GLIMMER_API_KEY"):
        OpenAICompatLLM(build_providers({"GLIMMER_BASE_URL": "http://h/v1"})["glimmer"])


def test_cli_accepts_glimmer_for_kid_and_tutor():
    args = parser().parse_args(["run", "--kid-provider", "glimmer", "--tutor-provider", "glimmer"])
    assert args.kid_provider == "glimmer" and args.tutor_provider == "glimmer"


def test_make_clients_mixes_providers(monkeypatch):
    monkeypatch.setattr(llm, "PROVIDERS", build_providers({"GLIMMER_BASE_URL": "http://h/v1"}))
    monkeypatch.setenv("GLIMMER_API_KEY", "k")
    monkeypatch.setenv("META_API_KEY", "k")
    clients = make_clients({"kid": RoleConfig("glimmer", "muse-glimmer"), "tutor": RoleConfig("meta", "x"),
                            "judge": RoleConfig("meta", "x")})
    assert clients["kid"].provider == "glimmer"
    assert clients["tutor"] is clients["judge"]


def test_check_glimmer_config_exits_without_base_url():
    with pytest.raises(SystemExit, match="kid use glimmer but GLIMMER_BASE_URL"):
        llm.check_glimmer_config({"kid": "glimmer", "tutor": "meta"}, {"GLIMMER_API_KEY": "k"})


def test_check_glimmer_config_modal_only_needs_url():
    llm.check_glimmer_config({"kid": "glimmer"}, {"GLIMMER_BASE_URL": "http://h/v1"}, required=("GLIMMER_BASE_URL",))
    llm.check_glimmer_config({"kid": "meta", "tutor": "auto"}, {})  # no glimmer: nothing required


def test_cli_exits_before_any_call_without_base_url(monkeypatch):
    from arandu_evals import cli

    monkeypatch.delenv("GLIMMER_BASE_URL", raising=False)

    async def boom(*a, **k):
        raise AssertionError("must not resolve providers")

    monkeypatch.setattr(cli, "resolve_roles", boom)
    with pytest.raises(SystemExit, match="GLIMMER_BASE_URL"):
        cli.main(["run", "--kid-provider", "glimmer"])


def test_glimmer_gets_longer_call_timeout(monkeypatch):
    monkeypatch.setenv("GLIMMER_API_KEY", "k")
    monkeypatch.setenv("META_API_KEY", "k")
    p = build_providers({"GLIMMER_BASE_URL": "http://h/v1"})
    assert OpenAICompatLLM(p["glimmer"])._client.timeout == 300
    assert OpenAICompatLLM(p["meta"])._client.timeout == 120


async def test_warm_up_only_for_glimmer(monkeypatch):
    called = []

    async def fake(name, **k):
        called.append(name)

    monkeypatch.setattr(llm, "warm_up", fake)
    await llm.warm_up_roles({"kid": RoleConfig("glimmer", "m"), "tutor": RoleConfig("meta", "x")})
    await llm.warm_up_roles({"tutor": RoleConfig("meta", "x")})
    assert called == ["glimmer"]


class _Msg:
    def __init__(self, content):
        self.content = content


class _Choice:
    def __init__(self, content, finish="stop"):
        self.message, self.finish_reason = _Msg(content), finish


class _Res:
    def __init__(self, content, finish="stop"):
        self.choices, self.usage = [_Choice(content, finish)], None


def _fake_client(contents):
    calls = []

    class Completions:
        async def create(self, **kw):
            calls.append(kw)
            c = contents.pop(0)
            return _Res(c, "length" if c is None else "stop")

    class Chat:
        completions = Completions()

    class Client:
        chat = Chat()

    return Client(), calls


async def test_empty_response_is_retried_and_counted(monkeypatch):
    monkeypatch.setenv("META_API_KEY", "k")
    monkeypatch.setattr(llm.asyncio, "sleep", lambda s: _noop())
    model = OpenAICompatLLM(build_providers({})["meta"], empty_retries=1)
    model._client, calls = _fake_client([None, "hola"])
    c = await model.complete([{"role": "user", "content": "x"}], temperature=0)
    assert c.text == "hola" and c.empty == 1 and len(calls) == 2


async def test_empty_twice_raises_with_finish_reason(monkeypatch):
    monkeypatch.setenv("META_API_KEY", "k")
    monkeypatch.setattr(llm.asyncio, "sleep", lambda s: _noop())
    model = OpenAICompatLLM(build_providers({})["meta"], empty_retries=1)
    model._client, _ = _fake_client([None, "  "])
    with pytest.raises(llm.EmptyResponseError, match=r"2 times \(finish_reason: length, stop\)"):
        await model.complete([{"role": "user", "content": "x"}], temperature=0)


async def _noop():
    return None
