#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════╗
║           🇧🇷  Agente IBGE  —  Powered by Claude         ║
║   Responde perguntas sobre dados do Brasil em tempo real  ║
╚══════════════════════════════════════════════════════════╝

Conecta ao ibge-mcp-server via stdio e usa Claude como
motor de raciocínio para responder perguntas complexas
sobre população, economia, indicadores e localidades.

Pré-requisitos:
  pip install anthropic
  export ANTHROPIC_API_KEY="sk-ant-..."
  (ibge-mcp-server compilado em ../ibge-mcp-server/dist/index.js)
"""

import asyncio
import json
import os
import subprocess
import sys
import textwrap
from typing import Any

import anthropic

# ─── Configuração ────────────────────────────────────────────────────────────

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL = "claude-opus-4-5"

# Caminho para o servidor MCP (ajuste se necessário)
MCP_SERVER_PATH = os.environ.get(
    "IBGE_MCP_PATH",
    os.path.join(os.path.dirname(__file__), "../dist/index.js"),
)

MAX_ITERATIONS = 10  # Máximo de chamadas de ferramentas por pergunta

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
                "Execute 'npm run build' na pasta ibge-mcp-server."
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
        resp = self._send("tools/list")
        return resp.get("result", {}).get("tools", [])

    def call_tool(self, name: str, arguments: dict) -> str:
        resp = self._send("tools/call", {"name": name, "arguments": arguments})
        result = resp.get("result", {})
        content = result.get("content", [])
        if content and isinstance(content, list):
            return content[0].get("text", "")
        return str(result)


# ─── Agente principal ─────────────────────────────────────────────────────────

class AgenteIBGE:
    """
    Agente de IA que usa Claude + IBGE MCP Server para responder
    perguntas sobre dados do Brasil com raciocínio em múltiplos passos.
    """

    SYSTEM_PROMPT = """Você é um especialista em dados do Brasil, com acesso às APIs oficiais do IBGE.

Você responde perguntas sobre:
- População, território e densidade demográfica (Censo 2022 + Estimativas anuais)
- Nomes brasileiros: frequência histórica por década e rankings de popularidade
- Indicadores econômicos: IPCA, desemprego, PIB, rendimento (SIDRA/PNAD)
- PIB estadual e municipal com séries históricas
- Localidades: regiões, estados, municípios do Brasil (busca flexível sem acentos)
- CNAE: Classificação Nacional de Atividades Econômicas
  • Identifica e explica códigos CNAE para qualquer atividade
  • Navega pela hierarquia: Seção > Divisão > Grupo > Classe > Subclasse
  • Ajuda a encontrar o CNAE correto para abertura de empresa
  • Explica diferenças entre atividades similares

Diretrizes gerais:
- Use SEMPRE as ferramentas para obter dados reais (nunca invente números, nomes ou códigos CNAE)
- Faça múltiplas chamadas quando necessário (ex: buscar ID primeiro, depois dados)
- Apresente dados com formatação adequada (tabelas markdown quando possível)
- Contextualize os números (ex: "representa X% da população total")
- Cite sempre a fonte e o período dos dados
- Se o usuário pedir comparações, busque TODOS os dados necessários antes de responder
- Responda sempre em português brasileiro

Para Nomes especificamente:
- Use ibge_nomes_frequencia para saber quantas pessoas têm determinado nome
- Use ibge_nomes_ranking para descobrir os nomes mais populares
- Dados disponíveis por década desde 1930, com filtros por sexo e localidade
- Sempre informe o total nacional e contextualize os números

Para População e PIB:
- Para dados mais recentes que 2022, use ibge_estimativas_populacionais (2001-2024+)
- Para PIB estadual, use ibge_pib_estados com o ano desejado
- Aceita múltiplas variáveis simultaneamente no SIDRA (use pipe: "63|44|93")
- Busca de municípios funciona sem acentos (ex: "Sao Paulo" encontra "São Paulo")

Para CNAE especificamente:
- Use ibge_cnae_buscar para encontrar CNAEs por descrição de atividade
- Use ibge_cnae_detalhar para ver subclasses de uma classe ou grupos de uma divisão
- Use ibge_cnae_secoes para visão geral de todos os setores
- Quando o usuário descrever um negócio, identifique a subclasse mais específica
- Sempre mostre o caminho hierárquico completo (Seção > Divisão > Grupo > Classe > Subclasse)
- Para tabelas comparativas de CNAEs, busque cada atividade separadamente"""

    def __init__(self, mcp: MCPClient, tools: list[dict]):
        self.mcp = mcp
        self.tools = tools
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        self.historico: list[dict] = []

    def _tools_para_anthropic(self) -> list[dict]:
        """Converte ferramentas MCP para o formato da API Anthropic."""
        result = []
        for tool in self.tools:
            # Converter schema Zod/JSON para formato Anthropic
            input_schema = tool.get("inputSchema", {})
            if not isinstance(input_schema, dict):
                input_schema = {"type": "object", "properties": {}}
            # Garantir que tem type: object
            if "type" not in input_schema:
                input_schema["type"] = "object"
            if "properties" not in input_schema:
                input_schema["properties"] = {}

            result.append({
                "name": tool["name"],
                "description": tool.get("description", ""),
                "input_schema": input_schema,
            })
        return result

    def _executar_ferramentas(self, tool_uses: list) -> list[dict]:
        """Executa chamadas de ferramentas e retorna resultados."""
        resultados = []
        for tool_use in tool_uses:
            nome = tool_use.name
            args = tool_use.input

            print(c("ciano", f"  🔧 {nome}"), end="")
            if args:
                args_str = ", ".join(f"{k}={repr(v)}" for k, v in args.items())
                print(c("cinza", f"({args_str})"), end="")
            print()

            try:
                resultado = self.mcp.call_tool(nome, args)
                # Preview do resultado
                preview = resultado[:120].replace("\n", " ")
                print(c("cinza", f"     ↳ {preview}{'...' if len(resultado) > 120 else ''}"))

                resultados.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": resultado,
                })
            except Exception as e:
                erro = f"Erro ao executar {nome}: {e}"
                print(c("vermelho", f"     ↳ {erro}"))
                resultados.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": erro,
                    "is_error": True,
                })
        return resultados

    def perguntar(self, pergunta: str) -> str:
        """
        Processa uma pergunta usando o loop agente:
        1. Envia para Claude com as ferramentas disponíveis
        2. Se Claude quer usar ferramentas, executa e retorna resultados
        3. Repete até Claude ter uma resposta final
        """
        print(c("cinza", "\n  ⚙️  Processando..."))

        # Adicionar pergunta ao histórico
        self.historico.append({"role": "user", "content": pergunta})
        mensagens = self.historico.copy()

        tools_anthropic = self._tools_para_anthropic()
        iteracoes = 0
        # Rastrear ferramentas que já falharam para evitar loops de retry
        ferramentas_com_erro: dict[str, int] = {}  # tool_name → nº de falhas
        MAX_FALHAS_POR_TOOL = 2

        while iteracoes < MAX_ITERATIONS:
            iteracoes += 1

            # Chamar Claude
            resposta = self.client.messages.create(
                model=MODEL,
                max_tokens=4096,
                system=self.SYSTEM_PROMPT,
                tools=tools_anthropic,
                messages=mensagens,
            )

            # Verificar se Claude quer usar ferramentas
            tool_uses = [b for b in resposta.content if b.type == "tool_use"]

            if tool_uses:
                print(c("amarelo", f"\n  📡 Buscando dados ({iteracoes}/{MAX_ITERATIONS}):"))

                # Verificar se Claude está repetindo ferramentas que já falharam demais
                bloqueadas = []
                for tu in tool_uses:
                    falhas = ferramentas_com_erro.get(tu.name, 0)
                    if falhas >= MAX_FALHAS_POR_TOOL:
                        bloqueadas.append(tu.name)

                if bloqueadas:
                    print(c("vermelho", f"  ⛔ Bloqueando tools com muitas falhas: {bloqueadas}"))
                    # Forçar resposta final com o que foi coletado
                    mensagens.append({"role": "assistant", "content": resposta.content})
                    aviso = f"As ferramentas {bloqueadas} falharam {MAX_FALHAS_POR_TOOL}x consecutivas e estão bloqueadas. Responda com os dados já coletados, mesmo que incompletos. Explique o que estava indisponível."
                    mensagens.append({"role": "user", "content": [{"type": "tool_result", "tool_use_id": tool_uses[0].id, "content": aviso}]})
                    # Remove para não loop
                    break

                # Adicionar resposta do assistente ao histórico
                mensagens.append({
                    "role": "assistant",
                    "content": resposta.content,
                })

                # Executar ferramentas
                resultados = self._executar_ferramentas(tool_uses)

                # Contar falhas por ferramenta
                for i, resultado in enumerate(resultados):
                    nome = tool_uses[i].name if i < len(tool_uses) else "?"
                    if resultado.get("is_error") or "Erro na API" in str(resultado.get("content", "")):
                        ferramentas_com_erro[nome] = ferramentas_com_erro.get(nome, 0) + 1
                    else:
                        ferramentas_com_erro[nome] = 0  # reset em sucesso

                # Adicionar resultados ao histórico
                mensagens.append({
                    "role": "user",
                    "content": resultados,
                })

            else:
                # Claude tem a resposta final
                texto_final = "".join(
                    b.text for b in resposta.content if hasattr(b, "text")
                )

                # Salvar no histórico para contexto futuro
                self.historico.append({
                    "role": "assistant",
                    "content": texto_final,
                })

                return texto_final

        return "⚠️ Limite de iterações atingido. Tente uma pergunta mais específica."

    def limpar_historico(self) -> None:
        """Reinicia o contexto da conversa."""
        self.historico = []


# ─── Interface de terminal ────────────────────────────────────────────────────

# Exemplos agrupados por categoria para o menu /exemplos
EXEMPLOS_CATEGORIAS = {
    "👤 Nomes Brasileiros (NOVO v2.0)": [
        "Quantas pessoas se chamam João no Brasil?",
        "Quais os 20 nomes femininos mais populares da década de 1990?",
        "Compare a frequência do nome Maria entre 1930 e 2010",
        "Qual o nome masculino mais popular em São Paulo?",
        "Me mostre o ranking de nomes no Nordeste na década de 2000",
    ],
    "🏘️  População & Território": [
        "Qual o estado mais populoso do Brasil e quanto representa do total nacional?",
        "Qual a população estimada do Brasil em 2024? (NOVO - estimativas)",
        "Compare a densidade demográfica de SP, RJ e MG",
        "Busque municípios com 'Sao Paulo' sem acento (NOVO - busca flexível)",
        "Qual a diferença populacional entre o Nordeste e o Sul do Brasil?",
        "Quais os 10 municípios mais populosos de Minas Gerais?",
    ],
    "💰 Economia & PIB (Melhorado v2.0)": [
        "Qual foi a inflação IPCA nos últimos 6 meses?",
        "Qual o ranking de PIB dos estados brasileiros em 2021? (NOVO)",
        "Compare o PIB per capita de SP, RJ e MG em 2020 (NOVO)",
        "Me dê um resumo econômico do Brasil: PIB, inflação e desemprego",
        "Qual a taxa de desemprego atual e como evoluiu nos últimos trimestres?",
        "Quais os municípios com maior PIB per capita em São Paulo?",
    ],
    "🎓 Educação & Social": [
        "Quais os municípios com maior taxa de alfabetização no Nordeste?",
        "Compare a taxa de alfabetização entre as regiões do Brasil",
        "Quais os estados com piores índices de escolaridade?",
    ],
    "🏭 CNAE — Atividades Econômicas": [
        "Qual o código CNAE de uma padaria?",
        "Quais são as atividades da seção G da CNAE (Comércio)?",
        "Qual CNAE se enquadra desenvolvimento de software?",
        "Me mostre a hierarquia completa do CNAE de restaurantes",
        "Quais atividades econômicas existem na divisão 47 da CNAE?",
        "Qual a diferença entre as subclasses de comércio varejista de alimentos?",
        "Que seção da CNAE cobre serviços de saúde? Me dê exemplos de subclasses.",
        "Estou abrindo uma clínica veterinária, qual o CNAE correto?",
    ],
}

# Lista plana para compatibilidade com seleção por número
EXEMPLOS = [ex for exs in EXEMPLOS_CATEGORIAS.values() for ex in exs]

def imprimir_banner() -> None:
    print()
    print(c("bold", c("verde", "╔══════════════════════════════════════════════════════════╗")))
    print(c("bold", c("verde", "║") + c("bold", "           🇧🇷  Agente IBGE  —  Powered by Claude         ") + c("verde", "║")))
    print(c("bold", c("verde", "║") + c("cinza", "   Responde perguntas sobre dados do Brasil em tempo real  ") + c("verde", "║")))
    print(c("bold", c("verde", "╚══════════════════════════════════════════════════════════╝")))
    print()

def imprimir_ajuda(num_tools: int) -> None:
    print(c("cinza", f"  {num_tools} ferramentas IBGE carregadas\n"))
    print(c("bold", "  Comandos especiais:"))
    print(c("cinza", "    /exemplos  — mostra perguntas de exemplo"))
    print(c("cinza", "    /limpar    — reinicia o histórico da conversa"))
    print(c("cinza", "    /ferramentas — lista as ferramentas disponíveis"))
    print(c("cinza", "    /sair      — encerra o agente"))
    print()

def imprimir_exemplos() -> None:
    print(c("bold", "\n  💡 Exemplos de perguntas:"))
    idx = 1
    for categoria, exemplos in EXEMPLOS_CATEGORIAS.items():
        print()
        print(c("bold", c("amarelo", f"  {categoria}")))
        for ex in exemplos:
            print(c("ciano", f"  {idx}.") + f" {ex}")
            idx += 1
    print()
    print(c("cinza", "  Digite o número para usar o exemplo direto."))
    print()

def formatar_resposta(texto: str) -> str:
    """Formata a resposta com indentação e destaque."""
    linhas = texto.split("\n")
    formatadas = []
    for linha in linhas:
        if linha.startswith("##"):
            formatadas.append(c("bold", c("azul", "  " + linha)))
        elif linha.startswith("#"):
            formatadas.append(c("bold", c("verde", "  " + linha)))
        elif linha.startswith("**") and linha.endswith("**"):
            formatadas.append(c("bold", "  " + linha))
        elif linha.startswith("- ") or linha.startswith("• "):
            formatadas.append(c("ciano", "  " + linha))
        elif linha.startswith("|"):
            formatadas.append(c("cinza", "  " + linha))
        else:
            formatadas.append("  " + linha)
    return "\n".join(formatadas)


async def main() -> None:
    imprimir_banner()

    # Verificar API key
    if not ANTHROPIC_API_KEY:
        print(c("vermelho", "  ❌ ANTHROPIC_API_KEY não configurada!"))
        print(c("cinza", "  Execute: export ANTHROPIC_API_KEY='sk-ant-...'"))
        sys.exit(1)

    # Iniciar servidor MCP
    print(c("cinza", f"  Iniciando IBGE MCP Server..."))
    mcp = MCPClient(MCP_SERVER_PATH)

    try:
        mcp.start()
    except FileNotFoundError as e:
        print(c("vermelho", f"  ❌ {e}"))
        sys.exit(1)

    # Listar ferramentas disponíveis
    try:
        tools = mcp.list_tools()
    except Exception as e:
        print(c("vermelho", f"  ❌ Erro ao conectar com servidor MCP: {e}"))
        mcp.stop()
        sys.exit(1)

    print(c("verde", f"  ✅ Servidor conectado! {len(tools)} ferramentas disponíveis\n"))

    # Criar agente
    agente = AgenteIBGE(mcp, tools)

    imprimir_ajuda(len(tools))

    # Loop principal
    try:
        while True:
            try:
                pergunta = input(c("bold", c("verde", "  🇧🇷 Você: ")) + c("bold", "")).strip()
            except (EOFError, KeyboardInterrupt):
                break

            if not pergunta:
                continue

            # Comandos especiais
            if pergunta.lower() in ("/sair", "/exit", "sair", "exit", "quit"):
                break

            elif pergunta.lower() == "/exemplos":
                imprimir_exemplos()
                continue

            elif pergunta.lower() == "/limpar":
                agente.limpar_historico()
                print(c("verde", "  ✅ Histórico limpo.\n"))
                continue

            elif pergunta.lower() == "/ferramentas":
                print(c("bold", f"\n  🔧 Ferramentas disponíveis ({len(tools)}):"))
                for t in tools:
                    desc = t.get("description", "").split("\n")[0][:60]
                    print(f"  {c('ciano', t['name'])}")
                    print(c("cinza", f"    {desc}"))
                print()
                continue

            elif pergunta.startswith("/") and pergunta[1:].isdigit():
                idx = int(pergunta[1:]) - 1
                if 0 <= idx < len(EXEMPLOS):
                    pergunta = EXEMPLOS[idx]
                    print(c("cinza", f"  → {pergunta}"))
                else:
                    print(c("vermelho", "  Número inválido."))
                    continue

            # Processar pergunta
            print()
            try:
                resposta = agente.perguntar(pergunta)
                print()
                print(c("bold", c("azul", "  🤖 Agente:")))
                print(formatar_resposta(resposta))
                print()

            except anthropic.AuthenticationError:
                print(c("vermelho", "  ❌ API key inválida. Verifique ANTHROPIC_API_KEY."))
            except anthropic.RateLimitError:
                print(c("vermelho", "  ❌ Rate limit atingido. Aguarde alguns segundos."))
            except Exception as e:
                print(c("vermelho", f"  ❌ Erro: {e}"))

    finally:
        mcp.stop()
        print(c("cinza", "\n  Até logo! 👋\n"))


if __name__ == "__main__":
    asyncio.run(main())
