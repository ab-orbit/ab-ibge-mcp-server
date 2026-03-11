#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════╗
║    🇧🇷  Agente IBGE  —  Interactive Setup Edition       ║
║  Responde perguntas sobre dados oficiais do Brasil      ║
╚══════════════════════════════════════════════════════════╝

Versão com configuração interativa:
1. Seleciona o provider desejado
2. Lista e escolhe o modelo
3. Inicia sessão de perguntas

Uso:
  python agente_ibge_v3.py
"""

import json
import os
import subprocess
import sys
from typing import Any, List, Dict, Optional

from providers import get_provider, list_all_providers, LLMProvider

# ─── Configuração ────────────────────────────────────────────────────────────

MCP_SERVER_PATH = os.environ.get(
    "IBGE_MCP_PATH",
    os.path.join(os.path.dirname(__file__), "../dist/index.js"),
)

MAX_ITERATIONS = 10

CORES = {
    "reset": "\033[0m",
    "bold": "\033[1m",
    "verde": "\033[92m",
    "azul": "\033[94m",
    "ciano": "\033[96m",
    "amarelo": "\033[93m",
    "cinza": "\033[90m",
    "vermelho": "\033[91m",
    "magenta": "\033[95m",
}

def c(cor: str, texto: str) -> str:
    """Aplica cor ANSI ao texto."""
    return f"{CORES.get(cor, '')}{texto}{CORES['reset']}"


# ─── Cliente MCP via stdio ────────────────────────────────────────────────────

class MCPClient:
    """Cliente simples para comunicação com servidor MCP via stdio."""

    def __init__(self, server_path: str):
        self.server_path = server_path
        self.process: subprocess.Popen | None = None
        self._id = 0

    def _next_id(self) -> int:
        self._id += 1
        return self._id

    def start(self) -> None:
        if not os.path.exists(self.server_path):
            raise FileNotFoundError(
                f"Servidor MCP não encontrado em: {self.server_path}\n"
                "Execute 'npm run build' na pasta raiz do projeto."
            )
        self.process = subprocess.Popen(
            ["node", self.server_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )

    def stop(self) -> None:
        if self.process:
            self.process.terminate()
            self.process = None

    def _send(self, method: str, params: dict | None = None) -> dict:
        assert self.process and self.process.stdin and self.process.stdout
        msg = {"jsonrpc": "2.0", "id": self._next_id(), "method": method}
        if params:
            msg["params"] = params
        self.process.stdin.write(json.dumps(msg) + "\n")
        self.process.stdin.flush()
        line = self.process.stdout.readline()
        return json.loads(line)

    def list_tools(self) -> list[dict]:
        result = self._send("tools/list")
        return result.get("result", {}).get("tools", [])

    def call_tool(self, name: str, arguments: dict) -> str:
        result = self._send("tools/call", {"name": name, "arguments": arguments})
        tool_result = result.get("result", {})
        if "content" in tool_result:
            return "\n".join(
                block.get("text", "") for block in tool_result["content"] if block.get("type") == "text"
            )
        return str(tool_result)


# ─── System Prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a function-calling AI assistant for Brazilian official data (IBGE).

WORKFLOW:
1. User asks → Call appropriate tool ONCE with correct parameters
2. Receive results → Analyze and respond in Portuguese
3. NEVER call the same tool again

TOOL PARAMETERS EXAMPLES:
- ibge_search_nomes(name="Maria") to search for name statistics
- ibge_metadata_indicators(query="IPCA") to search for indicators
- ibge_get_aggregate(query="população") to get aggregate data

CRITICAL RULES:
- Call tools ONCE only
- After tool results, respond immediately in Portuguese
- Do NOT explain what to do, just do it
- Do NOT call tools multiple times

Example:
User: "Quantas pessoas se chamam Maria?"
You: [calls ibge_search_nomes with name="Maria"]
System: [returns statistics]
You: "De acordo com o IBGE, existem aproximadamente X pessoas chamadas Maria no Brasil..."

Remember: ONE tool call per question!"""

# ─── Conversor de ferramentas ────────────────────────────────────────────────

def convert_mcp_tools_to_anthropic_format(mcp_tools: list[dict]) -> list[dict]:
    """Converte ferramentas MCP para formato Anthropic."""
    anthropic_tools = []
    for tool in mcp_tools:
        anthropic_tools.append({
            "name": tool["name"],
            "description": tool.get("description", ""),
            "input_schema": tool.get("inputSchema", {}),
        })
    return anthropic_tools


def filter_relevant_tools(user_message: str, all_tools: list[dict], max_tools: int = 5) -> list[dict]:
    """
    Filtra ferramentas relevantes baseado na mensagem do usuário.
    Isso ajuda modelos menores (como Llama 3.2 3B) a focar nas ferramentas certas.
    """
    message_lower = user_message.lower()

    # Palavras-chave para identificar tipo de consulta (nomes corretos do IBGE MCP)
    keywords_map = {
        "nomes": ["nome", "nomes", "chamam", "maria", "joão", "pessoa", "frequência", "ranking"],
        "ipca": ["ipca", "inflação", "índice", "preço"],
        "pib": ["pib", "produto interno", "economia", "econômico"],
        "população": ["população", "habitantes", "populoso", "pessoas", "censo", "demográfica"],
        "município": ["município", "cidade", "cidades", "municipal"],
        "estado": ["estado", "estados", "uf"],
        "região": ["região", "regiões", "regional"],
        "tabela": ["tabela", "sidra", "dados", "estatística"],
        "indicador": ["indicador", "indicadores", "dados econômicos"],
        "notícia": ["notícia", "notícias", "últimas", "novidades"],
        "cnae": ["cnae", "atividade econômica", "setor"],
    }

    # Dar pontuação para cada ferramenta
    tool_scores = []
    for tool in all_tools:
        score = 0
        tool_name = tool["name"]

        # Remover prefixo ibge_
        short_name = tool_name.replace("ibge_", "")

        # Verificar se nome da ferramenta aparece na mensagem
        if short_name in message_lower:
            score += 10

        # Verificar palavras-chave
        for key, keywords in keywords_map.items():
            if key in short_name:  # Verifica se a chave está no nome da ferramenta
                for keyword in keywords:
                    if keyword in message_lower:
                        score += 3
                        break

        tool_scores.append((score, tool))

    # Ordenar por pontuação e pegar as top N
    tool_scores.sort(key=lambda x: x[0], reverse=True)

    # Sempre incluir ferramentas com pontuação > 0
    filtered = [tool for score, tool in tool_scores[:max_tools] if score > 0]

    # Se não encontrou nenhuma ferramenta relevante, retornar as 3 mais comuns
    if not filtered:
        common_tools = ["ibge_nomes_frequencia", "ibge_ipca", "ibge_populacao_censo2022"]
        filtered = [t for t in all_tools if t["name"] in common_tools][:3]

    return filtered


# ─── Agente de raciocínio ────────────────────────────────────────────────────

def run_agent_loop(
    provider: LLMProvider,
    mcp_client: MCPClient,
    user_message: str,
    conversation_history: list[dict],
    max_iterations: int = MAX_ITERATIONS,
) -> str:
    """Executa o loop agente: pergunta → chamada de ferramentas → resposta."""
    mcp_tools = mcp_client.list_tools()
    anthropic_tools = convert_mcp_tools_to_anthropic_format(mcp_tools)

    # Para modelos localhost menores, filtrar ferramentas relevantes
    if hasattr(provider, "base_url"):  # É um LocalhostProvider
        # Filtrar ferramentas relevantes para a pergunta
        filtered_mcp_tools = filter_relevant_tools(user_message, mcp_tools, max_tools=4)
        anthropic_tools = convert_mcp_tools_to_anthropic_format(filtered_mcp_tools)

        tool_names = [t["name"].replace("ibge_", "") for t in filtered_mcp_tools]
        print(c("amarelo", f"  🎯 Ferramentas selecionadas: {', '.join(tool_names)}"))

    # Adicionar system prompt na primeira mensagem se a conversa estiver vazia
    if not conversation_history:
        conversation_history.append({"role": "system", "content": SYSTEM_PROMPT})

    conversation_history.append({"role": "user", "content": user_message})

    failed_tools: dict[str, int] = {}
    blocked_tools: set[str] = set()
    tool_call_history: list[str] = []  # Track tool calls to detect loops
    disable_tools_next = False  # Control flag for localhost models

    for iteration in range(1, max_iterations + 1):
        print(c("cinza", f"\n  ⚙️  Processando..."))

        available_tools = [t for t in anthropic_tools if t["name"] not in blocked_tools]

        # If we're in a loop (same 3 tool calls in a row), force text-only response
        force_text_only = False
        if len(tool_call_history) >= 3:
            last_three = tool_call_history[-3:]
            if last_three[0] == last_three[1] == last_three[2]:
                print(c("amarelo", f"  🔄 Loop detectado com {last_three[0]}, forçando resposta..."))
                force_text_only = True
                available_tools = None  # Disable tools

        # Disable tools if flag was set in previous iteration
        if disable_tools_next:
            print(c("amarelo", f"  💬 Forçando resposta em texto..."))
            available_tools = None

        try:
            response = provider.create_message(
                messages=conversation_history,
                max_tokens=4096,
                tools=available_tools if available_tools else None,
            )
            formatted_response = provider.format_response(response)
        except Exception as e:
            error_msg = f"❌ Erro ao chamar o LLM: {e}"
            print(c("vermelho", f"\n  {error_msg}"))
            return error_msg

        stop_reason = formatted_response.get("stop_reason", "")
        content_blocks = formatted_response.get("content", [])

        tool_uses = [block for block in content_blocks if block.get("type") == "tool_use"]
        text_blocks = [block.get("text", "") for block in content_blocks if block.get("type") == "text"]

        if not tool_uses:
            final_text = "\n".join(text_blocks)
            conversation_history.append({"role": "assistant", "content": final_text})
            return final_text

        print(c("azul", f"\n  📡 Buscando dados IBGE ({iteration}/{max_iterations}):"))

        tool_results = []
        for tool_use in tool_uses:
            tool_name = tool_use.get("name", "")
            tool_input = tool_use.get("input", {})
            tool_id = tool_use.get("id", "")

            # Track tool calls for loop detection
            tool_call_history.append(tool_name)

            args_str = ", ".join([f"{k}={repr(v)}" for k, v in tool_input.items()])
            print(c("ciano", f"  🔧 {tool_name}({args_str})"))

            try:
                result = mcp_client.call_tool(tool_name, tool_input)
                print(c("verde", f"     ↳ {result[:120]}..."))

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_id,
                    "content": result,
                })

                if tool_name in failed_tools:
                    failed_tools[tool_name] = 0

            except Exception as e:
                error_msg = f"Erro: {str(e)}"
                print(c("vermelho", f"     ↳ {error_msg}"))

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_id,
                    "content": error_msg,
                    "is_error": True,
                })

                failed_tools[tool_name] = failed_tools.get(tool_name, 0) + 1

                if failed_tools[tool_name] >= 3:
                    blocked_tools.add(tool_name)

        if blocked_tools:
            blocked_list = list(blocked_tools)[:4]
            print(c("amarelo", f"  ⛔ Bloqueando tools com muitas falhas: {blocked_list}"))

        conversation_history.append({"role": "assistant", "content": content_blocks})
        conversation_history.append({"role": "user", "content": tool_results})

        # For localhost providers (smaller models), disable tools after first successful call
        # This forces the model to respond instead of calling tools repeatedly
        if hasattr(provider, "base_url") and iteration == 1:
            has_successful_result = any(not tr.get("is_error", False) for tr in tool_results)
            if has_successful_result:
                disable_tools_next = True

    return "⚠️ Limite de iterações atingido. Tente uma pergunta mais específica."


# ─── Setup Interativo ────────────────────────────────────────────────────────

def interactive_setup() -> Optional[LLMProvider]:
    """Setup interativo: escolha de provider e modelo."""

    print(c("bold", "\n╔══════════════════════════════════════════════════════════╗"))
    print(c("bold", "║    🇧🇷  Agente IBGE  —  Configuração Interativa        ║"))
    print(c("bold", "╚══════════════════════════════════════════════════════════╝\n"))

    # Passo 1: Verificar providers disponíveis
    print(c("azul", "📋 Verificando providers configurados...\n"))

    all_providers = list_all_providers()

    # Passo 2: Sempre mostrar opções de providers
    provider_list = list(all_providers.keys())

    # Adicionar opção para localhost se não está na lista
    if "localhost" not in provider_list:
        provider_list.append("localhost")

    # Se nenhum provider foi detectado, mostrar apenas localhost
    if not provider_list:
        print(c("amarelo", "⚠️  Nenhum provider configurado.\n"))
        print(c("cinza", "Configure uma API key ou execute Ollama localmente:\n"))
        print(c("cinza", "  export ANTHROPIC_API_KEY='sk-ant-...'"))
        print(c("cinza", "  export OPENAI_API_KEY='sk-...'"))
        print(c("cinza", "  export GOOGLE_API_KEY='...'"))
        print(c("cinza", "  ollama serve  # Para usar Ollama\n"))
        return None

    print(c("verde", "✅ Providers disponíveis:\n"))

    # Mostrar providers configurados com API keys
    display_num = 1
    for i, provider_name in enumerate(provider_list):
        if provider_name in all_providers:
            model_count = len(all_providers[provider_name])
            print(c("ciano", f"  {display_num}. {provider_name.upper()} ({model_count} modelos)"))
        elif provider_name == "localhost":
            print(c("amarelo", f"  {display_num}. LOCALHOST (Ollama/LM Studio)"))
        display_num += 1

    print()

    while True:
        try:
            choice = input(c("verde", "Escolha o provider [1]: ") or "1")
            provider_idx = int(choice) - 1
            if 0 <= provider_idx < len(provider_list):
                selected_provider = provider_list[provider_idx]
                break
            else:
                print(c("vermelho", f"❌ Escolha entre 1 e {len(provider_list)}"))
        except ValueError:
            print(c("vermelho", "❌ Digite um número válido"))
        except KeyboardInterrupt:
            print(c("amarelo", "\n\n👋 Cancelado pelo usuário.\n"))
            return None

    print(c("verde", f"\n✅ Provider selecionado: {selected_provider.upper()}\n"))

    # Passo 3: Listar e escolher modelo
    print(c("azul", "📋 Listando modelos disponíveis...\n"))

    try:
        # Criar provider temporário para listar modelos
        temp_provider = get_provider(selected_provider)
        available_models = temp_provider.list_models()

        if not available_models:
            print(c("vermelho", "❌ Nenhum modelo disponível para este provider"))
            return None

        print(c("verde", "✅ Modelos disponíveis:\n"))

        # Mostrar primeiros 15 modelos
        display_models = available_models[:15]
        for i, model in enumerate(display_models, 1):
            # Destacar modelos recomendados
            is_recommended = False
            if selected_provider == "anthropic" and "sonnet-4-5" in model:
                is_recommended = True
            elif selected_provider == "openai" and model == "gpt-4o":
                is_recommended = True
            elif selected_provider == "gemini" and "2.0-flash" in model:
                is_recommended = True

            prefix = "⭐" if is_recommended else "  "
            color = "verde" if is_recommended else "ciano"
            print(c(color, f"{prefix} {i}. {model}"))

        if len(available_models) > 15:
            print(c("cinza", f"\n   ... e mais {len(available_models) - 15} modelos"))
            print(c("amarelo", "   💡 Dica: Use números maiores para modelos não listados"))

        print()

        # Escolher modelo
        while True:
            try:
                model_choice = input(c("verde", "Escolha o modelo [1]: ") or "1")
                model_idx = int(model_choice) - 1

                if 0 <= model_idx < len(available_models):
                    selected_model = available_models[model_idx]
                    break
                else:
                    print(c("vermelho", f"❌ Escolha entre 1 e {len(available_models)}"))
            except ValueError:
                print(c("vermelho", "❌ Digite um número válido"))
            except KeyboardInterrupt:
                print(c("amarelo", "\n\n👋 Cancelado pelo usuário.\n"))
                return None

        print(c("verde", f"\n✅ Modelo selecionado: {selected_model}\n"))

        # Passo 4: Criar provider final
        print(c("azul", "🔧 Inicializando provider...\n"))
        provider = get_provider(selected_provider, selected_model)

        print(c("verde", "✅ Provider pronto!\n"))
        print(c("cinza", "─" * 60))
        print(c("bold", f"\n🤖 Provider: {selected_provider.upper()}"))
        print(c("bold", f"📦 Modelo: {selected_model}\n"))
        print(c("cinza", "─" * 60))

        return provider

    except Exception as e:
        print(c("vermelho", f"\n❌ Erro ao configurar provider: {e}\n"))
        return None


# ─── Loop interativo ──────────────────────────────────────────────────────────

def interactive_loop(provider: LLMProvider):
    """Loop interativo de perguntas e respostas."""
    mcp_client = MCPClient(MCP_SERVER_PATH)

    try:
        print()
        print(c("cinza", "Digite suas perguntas sobre dados oficiais do Brasil (IBGE)."))
        print(c("cinza", "Digite 'sair' para encerrar.\n"))

        # Iniciar servidor MCP
        mcp_client.start()
        print(c("verde", "✅ Servidor IBGE MCP iniciado\n"))
        print(c("cinza", "─" * 60))

        # Histórico de conversação
        conversation_history: list[dict] = []

        # Exemplos de perguntas
        print(c("amarelo", "\n💡 Exemplos de perguntas:"))
        print(c("cinza", "  • Quantas pessoas se chamam Maria no Brasil?"))
        print(c("cinza", "  • Qual a população do Rio de Janeiro em 2024?"))
        print(c("cinza", "  • Qual foi o IPCA dos últimos 12 meses?"))
        print(c("cinza", "  • Quais os 5 estados mais populosos?"))
        print(c("cinza", "  • Qual o PIB de São Paulo em 2021?"))
        print(c("cinza", "─" * 60))
        print()

        while True:
            try:
                user_input = input(c("verde", "🇧🇷 Você: "))
                if not user_input.strip():
                    continue
                if user_input.lower() in ["sair", "exit", "quit"]:
                    print(c("amarelo", "\n👋 Até logo!\n"))
                    break

                # Executar agente
                response = run_agent_loop(
                    provider, mcp_client, user_input, conversation_history, MAX_ITERATIONS
                )
                print(c("azul", "\n  🤖 Agente:"))
                print(f"  {response}\n")

            except KeyboardInterrupt:
                print(c("amarelo", "\n\n⚠️ Interrompido. Digite 'sair' para encerrar.\n"))
                continue

    except Exception as e:
        print(c("vermelho", f"\n❌ Erro: {e}\n"))
    finally:
        mcp_client.stop()
        print(c("cinza", "\n✅ Servidor MCP encerrado.\n"))


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    """Ponto de entrada principal."""
    try:
        # Setup interativo
        provider = interactive_setup()

        if provider is None:
            print(c("amarelo", "⚠️ Setup cancelado ou falhou.\n"))
            sys.exit(1)

        # Verificar MCP server
        if not os.path.exists(MCP_SERVER_PATH):
            print(c("vermelho", f"\n❌ MCP Server não encontrado em: {MCP_SERVER_PATH}"))
            print(c("amarelo", "Execute 'npm run build' na pasta raiz do projeto.\n"))
            sys.exit(1)

        # Loop interativo
        interactive_loop(provider)

    except KeyboardInterrupt:
        print(c("amarelo", "\n\n👋 Até logo!\n"))
        sys.exit(0)
    except Exception as e:
        print(c("vermelho", f"\n❌ Erro fatal: {e}\n"))
        sys.exit(1)


if __name__ == "__main__":
    main()
