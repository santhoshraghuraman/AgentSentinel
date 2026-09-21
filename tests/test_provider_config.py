"""
Provider Configuration Tests (Phase 4.7 — DEF-001).

Tests that the OllamaProvider correctly resolves model names,
respects environment variables, and never silently falls back
to a wrong model or DevelopmentProvider.
"""

import os
import pytest
from unittest.mock import patch, MagicMock

from src.agentsentinel.llm.provider import (
    OllamaProvider,
    DevelopmentProvider,
    get_llm_provider,
)


class TestOllamaProviderDefaults:
    """Verify default model resolution."""

    def test_default_model_is_qwen3_4b(self):
        """Default constructor must use qwen3:4b, not qwen3."""
        provider = OllamaProvider()
        assert provider.model == "qwen3:4b"

    def test_explicit_model_is_respected(self):
        """Explicit model parameter must be used as-is."""
        provider = OllamaProvider(model="llama3:8b")
        assert provider.model == "llama3:8b"

    def test_default_host(self):
        provider = OllamaProvider()
        assert provider.host == "http://localhost:11434"


class TestCheckAvailability:
    """Verify availability check uses exact model matching."""

    def _mock_tags_response(self, model_names):
        """Create a mock response for /api/tags."""
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        resp.json.return_value = {
            "models": [{"name": name} for name in model_names]
        }
        return resp

    @patch("src.agentsentinel.llm.provider.requests.get")
    def test_exact_match_available(self, mock_get):
        """Model 'qwen3:4b' must match exactly 'qwen3:4b'."""
        mock_get.return_value = self._mock_tags_response(["qwen3:4b", "llama3:8b"])
        provider = OllamaProvider(model="qwen3:4b")
        assert provider.check_availability() == "MODEL_AVAILABLE"

    @patch("src.agentsentinel.llm.provider.requests.get")
    def test_no_fuzzy_prefix_match(self, mock_get):
        """Model 'qwen3' must NOT match 'qwen3:4b' — exact match only."""
        mock_get.return_value = self._mock_tags_response(["qwen3:4b"])
        provider = OllamaProvider(model="qwen3")
        assert provider.check_availability() == "MODEL_MISSING"

    @patch("src.agentsentinel.llm.provider.requests.get")
    def test_model_missing(self, mock_get):
        """Non-existent model returns MODEL_MISSING."""
        mock_get.return_value = self._mock_tags_response(["llama3:8b"])
        provider = OllamaProvider(model="qwen3:4b")
        assert provider.check_availability() == "MODEL_MISSING"

    @patch("src.agentsentinel.llm.provider.requests.get")
    def test_ollama_unavailable(self, mock_get):
        """Connection failure returns OLLAMA_UNAVAILABLE."""
        import requests as req_lib
        mock_get.side_effect = req_lib.exceptions.ConnectionError("refused")
        provider = OllamaProvider(model="qwen3:4b")
        assert provider.check_availability() == "OLLAMA_UNAVAILABLE"

    @patch("src.agentsentinel.llm.provider.requests.get")
    def test_empty_model_list(self, mock_get):
        """Empty model list returns MODEL_MISSING."""
        mock_get.return_value = self._mock_tags_response([])
        provider = OllamaProvider(model="qwen3:4b")
        assert provider.check_availability() == "MODEL_MISSING"


class TestGetLLMProvider:
    """Verify get_llm_provider() environment variable handling."""

    @patch.dict(os.environ, {"AGENTSENTINEL_TEST_MODE": "1"}, clear=False)
    def test_test_mode_returns_development_provider(self):
        provider = get_llm_provider()
        assert isinstance(provider, DevelopmentProvider)

    @patch.dict(os.environ, {
        "OLLAMA_MODEL": "qwen3:4b",
    }, clear=False)
    @patch("src.agentsentinel.llm.provider.OllamaProvider.check_availability",
           return_value="MODEL_AVAILABLE")
    def test_explicit_model_env_var(self, mock_check):
        """OLLAMA_MODEL env var must be respected."""
        # Ensure test mode is off
        os.environ.pop("AGENTSENTINEL_TEST_MODE", None)
        os.environ.pop("LLM_API_KEY", None)
        provider = get_llm_provider()
        assert isinstance(provider, OllamaProvider)
        assert provider.model == "qwen3:4b"

    @patch("src.agentsentinel.llm.provider.OllamaProvider.check_availability",
           return_value="MODEL_AVAILABLE")
    def test_default_model_without_env_var(self, mock_check):
        """Without OLLAMA_MODEL, default must be qwen3:4b."""
        os.environ.pop("AGENTSENTINEL_TEST_MODE", None)
        os.environ.pop("OLLAMA_MODEL", None)
        os.environ.pop("LLM_API_KEY", None)
        provider = get_llm_provider()
        assert isinstance(provider, OllamaProvider)
        assert provider.model == "qwen3:4b"

    @patch("src.agentsentinel.llm.provider.OllamaProvider.check_availability",
           return_value="OLLAMA_UNAVAILABLE")
    def test_unavailable_raises(self, mock_check):
        """Unavailable Ollama must raise RuntimeError."""
        os.environ.pop("AGENTSENTINEL_TEST_MODE", None)
        os.environ.pop("LLM_API_KEY", None)
        with pytest.raises(RuntimeError, match="OLLAMA_UNAVAILABLE"):
            get_llm_provider()

    @patch("src.agentsentinel.llm.provider.OllamaProvider.check_availability",
           return_value="MODEL_MISSING")
    def test_missing_model_raises(self, mock_check):
        """Missing model must raise RuntimeError with MODEL_MISSING."""
        os.environ.pop("AGENTSENTINEL_TEST_MODE", None)
        os.environ.pop("LLM_API_KEY", None)
        with pytest.raises(RuntimeError, match="MODEL_MISSING"):
            get_llm_provider()


class TestChatUsesResolvedModel:
    """Verify the generate() method sends the resolved model to /api/chat."""

    @patch("src.agentsentinel.llm.provider.requests.post")
    def test_chat_sends_exact_model(self, mock_post):
        """The model sent to /api/chat must be the exact resolved model."""
        from src.agentsentinel.llm.provider import AgentMessage

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "message": {"role": "assistant", "content": "Hello"}
        }
        mock_post.return_value = mock_resp

        provider = OllamaProvider(model="qwen3:4b")
        provider.generate(
            [AgentMessage(role="user", content="test")],
            tools=[]
        )

        # Verify the payload sent to /api/chat
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        assert payload["model"] == "qwen3:4b"
