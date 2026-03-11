#!/usr/bin/env python3
"""
LLM Provider Abstraction Layer
Supports: Anthropic, OpenAI, Google Gemini, and localhost (Ollama/LM Studio)
"""
import os
import json
from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """Base class for LLM providers"""

    def __init__(self, model: str, api_key: Optional[str] = None):
        self.model = model
        self.api_key = api_key or self._get_default_api_key()

    @abstractmethod
    def _get_default_api_key(self) -> Optional[str]:
        """Get API key from environment"""
        pass

    @abstractmethod
    def list_models(self) -> List[str]:
        """List available models"""
        pass

    @abstractmethod
    def create_message(self, messages: List[Dict], max_tokens: int = 4096, tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """Create a message with the LLM"""
        pass

    @abstractmethod
    def format_response(self, response: Any) -> Dict[str, Any]:
        """Format response to standard structure"""
        pass


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider"""

    def __init__(self, model: str = "claude-opus-4-5-20251101", api_key: Optional[str] = None):
        super().__init__(model, api_key)
        from anthropic import Anthropic
        self.client = Anthropic(api_key=self.api_key)

    def _get_default_api_key(self) -> Optional[str]:
        return os.getenv("ANTHROPIC_API_KEY")

    def list_models(self) -> List[str]:
        """List available Claude models"""
        return [
            "claude-opus-4-5-20251101",
            "claude-sonnet-4-5-20250929",
            "claude-opus-4-20250514",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
        ]

    def create_message(self, messages: List[Dict], max_tokens: int = 4096, tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """Create message using Anthropic API"""
        params = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": messages,
        }
        if tools:
            params["tools"] = tools

        return self.client.messages.create(**params)

    def format_response(self, response: Any) -> Dict[str, Any]:
        """Format Anthropic response"""
        return {
            "content": response.content,
            "stop_reason": response.stop_reason,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            }
        }


class OpenAIProvider(LLMProvider):
    """OpenAI GPT provider"""

    def __init__(self, model: str = "gpt-4o", api_key: Optional[str] = None):
        super().__init__(model, api_key)
        from openai import OpenAI
        self.client = OpenAI(api_key=self.api_key)

    def _get_default_api_key(self) -> Optional[str]:
        return os.getenv("OPENAI_API_KEY")

    def list_models(self) -> List[str]:
        """List available OpenAI models"""
        try:
            models = self.client.models.list()
            # Filter to only GPT models
            gpt_models = [m.id for m in models.data if m.id.startswith(("gpt-", "o1-", "o3-"))]
            return sorted(gpt_models, reverse=True)
        except Exception as e:
            # Fallback to known models
            return [
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4-turbo",
                "gpt-4",
                "gpt-3.5-turbo",
                "o1-preview",
                "o1-mini",
            ]

    def create_message(self, messages: List[Dict], max_tokens: int = 4096, tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """Create message using OpenAI API"""
        # Convert Anthropic-style messages to OpenAI format
        openai_messages = []
        for msg in messages:
            if isinstance(msg["content"], str):
                openai_messages.append(msg)
            elif isinstance(msg["content"], list):
                # Handle complex content (tool results, etc.)
                text_parts = []
                for block in msg["content"]:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text_parts.append(block.get("text", ""))
                    elif isinstance(block, dict) and block.get("type") == "tool_result":
                        text_parts.append(f"Tool result: {block.get('content', '')}")
                openai_messages.append({"role": msg["role"], "content": "\n".join(text_parts)})

        params = {
            "model": self.model,
            "messages": openai_messages,
        }

        # o3/o1 models use max_completion_tokens instead of max_tokens
        if self.model.startswith(("o1-", "o3-")):
            params["max_completion_tokens"] = max_tokens
        else:
            params["max_tokens"] = max_tokens

        # Convert tools to OpenAI format if provided
        if tools:
            openai_tools = []
            for tool in tools:
                openai_tools.append({
                    "type": "function",
                    "function": {
                        "name": tool["name"],
                        "description": tool.get("description", ""),
                        "parameters": tool.get("input_schema", {})
                    }
                })
            params["tools"] = openai_tools
            params["tool_choice"] = "auto"

        return self.client.chat.completions.create(**params)

    def format_response(self, response: Any) -> Dict[str, Any]:
        """Format OpenAI response to Anthropic-like structure"""
        content = []
        message = response.choices[0].message

        # Handle text content
        if message.content:
            content.append({"type": "text", "text": message.content})

        # Handle tool calls
        if hasattr(message, "tool_calls") and message.tool_calls:
            for tool_call in message.tool_calls:
                content.append({
                    "type": "tool_use",
                    "id": tool_call.id,
                    "name": tool_call.function.name,
                    "input": json.loads(tool_call.function.arguments)
                })

        return {
            "content": content,
            "stop_reason": response.choices[0].finish_reason,
            "usage": {
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
            }
        }


class GeminiProvider(LLMProvider):
    """Google Gemini provider"""

    def __init__(self, model: str = "gemini-2.0-flash-exp", api_key: Optional[str] = None):
        super().__init__(model, api_key)
        import google.generativeai as genai
        genai.configure(api_key=self.api_key)
        self.client = genai.GenerativeModel(model)
        self.genai = genai

    def _get_default_api_key(self) -> Optional[str]:
        return os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

    def list_models(self) -> List[str]:
        """List available Gemini models"""
        try:
            models = self.genai.list_models()
            gemini_models = [m.name.replace("models/", "") for m in models if "gemini" in m.name.lower()]
            return sorted(gemini_models, reverse=True)
        except Exception:
            return [
                "gemini-2.0-flash-exp",
                "gemini-2.0-flash-thinking-exp-01-21",
                "gemini-exp-1206",
                "gemini-1.5-pro",
                "gemini-1.5-flash",
            ]

    def create_message(self, messages: List[Dict], max_tokens: int = 4096, tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """Create message using Gemini API"""
        # Convert messages to Gemini format
        gemini_messages = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            if isinstance(msg["content"], str):
                gemini_messages.append({"role": role, "parts": [msg["content"]]})
            elif isinstance(msg["content"], list):
                parts = []
                for block in msg["content"]:
                    if isinstance(block, dict) and block.get("type") == "text":
                        parts.append(block.get("text", ""))
                gemini_messages.append({"role": role, "parts": parts})

        # Note: Gemini function calling would need conversion here
        # For now, we'll just use text generation
        response = self.client.generate_content(
            gemini_messages[-1]["parts"] if gemini_messages else ["Hello"],
            generation_config={"max_output_tokens": max_tokens}
        )

        return response

    def format_response(self, response: Any) -> Dict[str, Any]:
        """Format Gemini response"""
        return {
            "content": [{"type": "text", "text": response.text}],
            "stop_reason": "end_turn",
            "usage": {
                "input_tokens": 0,  # Gemini doesn't provide token counts easily
                "output_tokens": 0,
            }
        }


class LocalhostProvider(LLMProvider):
    """Localhost provider (Ollama, LM Studio, etc.)"""

    def __init__(self, model: str = "llama3.2", api_key: Optional[str] = None, base_url: str = "http://localhost:11434"):
        self.base_url = base_url.rstrip("/")
        super().__init__(model, api_key)
        import requests
        self.session = requests.Session()

    def _get_default_api_key(self) -> Optional[str]:
        return None  # Localhost doesn't need API key

    def list_models(self) -> List[str]:
        """List available localhost models"""
        import requests
        try:
            # Try Ollama format
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return [m["name"] for m in data.get("models", [])]
        except Exception:
            pass

        try:
            # Try OpenAI-compatible format (LM Studio)
            response = requests.get(f"{self.base_url}/v1/models", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return [m["id"] for m in data.get("data", [])]
        except Exception:
            pass

        return ["llama3.2", "mistral", "codellama"]

    def create_message(self, messages: List[Dict], max_tokens: int = 4096, tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """Create message using localhost API"""
        import requests

        # Convert to simple chat format
        chat_messages = []
        system_message = None

        for msg in messages:
            role = msg["role"]

            # Extract system messages
            if role == "system":
                if isinstance(msg["content"], str):
                    system_message = msg["content"]
                continue

            if isinstance(msg["content"], str):
                chat_messages.append({"role": role, "content": msg["content"]})
            elif isinstance(msg["content"], list):
                text_parts = []
                tool_results = []

                for block in msg["content"]:
                    if isinstance(block, dict):
                        if block.get("type") == "text":
                            text_parts.append(block.get("text", ""))
                        elif block.get("type") == "tool_result":
                            # Format tool results for Ollama
                            tool_results.append(f"Tool result: {block.get('content', '')}")

                content = "\n".join(text_parts + tool_results) if text_parts or tool_results else ""
                if content:
                    chat_messages.append({"role": role, "content": content})

        # Convert tools to Ollama format
        ollama_tools = None
        if tools:
            ollama_tools = []
            for tool in tools:
                ollama_tools.append({
                    "type": "function",
                    "function": {
                        "name": tool["name"],
                        "description": tool.get("description", ""),
                        "parameters": tool.get("input_schema", {})
                    }
                })

        # Try Ollama format first
        try:
            # Add system message at the beginning if present
            if system_message and chat_messages:
                chat_messages.insert(0, {"role": "system", "content": system_message})

            payload = {
                "model": self.model,
                "messages": chat_messages,
                "stream": False,
                "options": {"num_predict": max_tokens}
            }

            if ollama_tools:
                payload["tools"] = ollama_tools
            # Debug logging (uncomment to see what's being sent)
            # import json as _json
            # print("\n🔍 DEBUG - Payload to Ollama:")
            # print(f"  System message: {system_message[:50] if system_message else 'None'}...")
            # print(f"  Chat messages: {len(chat_messages)}")
            # for i, msg in enumerate(chat_messages[:3]):  # Show first 3
            #     print(f"    [{i}] {msg['role']}: {msg['content'][:60]}...")
            # print(f"  Tools: {len(ollama_tools) if ollama_tools else 0}")

            response = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=60
            )
            if response.status_code == 200:
                return response.json()
        except Exception:
            pass

        # Try OpenAI-compatible format (LM Studio)
        response = requests.post(
            f"{self.base_url}/v1/chat/completions",
            json={
                "model": self.model,
                "messages": chat_messages,
                "max_tokens": max_tokens,
            },
            timeout=60
        )
        return response.json()

    def format_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Format localhost response"""
        # Handle Ollama format
        if "message" in response:
            message = response["message"]
            content = []

            # Add text content if present
            if message.get("content"):
                content.append({"type": "text", "text": message["content"]})

            # Add tool calls if present
            if "tool_calls" in message and message["tool_calls"]:
                for i, tool_call in enumerate(message["tool_calls"]):
                    function = tool_call.get("function", {})
                    content.append({
                        "type": "tool_use",
                        "id": f"toolu_{i}_{function.get('name', 'unknown')}",
                        "name": function.get("name", ""),
                        "input": function.get("arguments", {})
                    })

            # If no content at all, add empty text
            if not content:
                content.append({"type": "text", "text": ""})

            return {
                "content": content,
                "stop_reason": response.get("done_reason", "end_turn"),
                "usage": {
                    "input_tokens": response.get("prompt_eval_count", 0),
                    "output_tokens": response.get("eval_count", 0)
                }
            }

        # Handle OpenAI-compatible format
        if "choices" in response:
            return {
                "content": [{"type": "text", "text": response["choices"][0]["message"]["content"]}],
                "stop_reason": response["choices"][0]["finish_reason"],
                "usage": {
                    "input_tokens": response.get("usage", {}).get("prompt_tokens", 0),
                    "output_tokens": response.get("usage", {}).get("completion_tokens", 0),
                }
            }

        return {
            "content": [{"type": "text", "text": str(response)}],
            "stop_reason": "end_turn",
            "usage": {"input_tokens": 0, "output_tokens": 0}
        }


def get_provider(provider_name: str, model: Optional[str] = None, api_key: Optional[str] = None, base_url: Optional[str] = None) -> LLMProvider:
    """Factory function to get the appropriate provider"""
    provider_name = provider_name.lower()

    if provider_name == "anthropic":
        return AnthropicProvider(model or "claude-opus-4-5-20251101", api_key)
    elif provider_name == "openai":
        return OpenAIProvider(model or "gpt-4o", api_key)
    elif provider_name == "gemini" or provider_name == "google":
        return GeminiProvider(model or "gemini-2.0-flash-exp", api_key)
    elif provider_name == "localhost" or provider_name == "ollama":
        return LocalhostProvider(model or "llama3.2", api_key, base_url or "http://localhost:11434")
    else:
        raise ValueError(f"Unknown provider: {provider_name}. Supported: anthropic, openai, gemini, localhost")


def list_all_providers() -> Dict[str, List[str]]:
    """List all available providers and their models"""
    providers = {}

    # Anthropic
    try:
        if os.getenv("ANTHROPIC_API_KEY"):
            provider = AnthropicProvider()
            providers["anthropic"] = provider.list_models()
    except Exception:
        pass

    # OpenAI
    try:
        if os.getenv("OPENAI_API_KEY"):
            provider = OpenAIProvider()
            providers["openai"] = provider.list_models()
    except Exception:
        pass

    # Gemini
    try:
        if os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"):
            provider = GeminiProvider()
            providers["gemini"] = provider.list_models()
    except Exception:
        pass

    # Localhost
    try:
        provider = LocalhostProvider()
        providers["localhost"] = provider.list_models()
    except Exception:
        pass

    return providers
