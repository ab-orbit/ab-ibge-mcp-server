#!/usr/bin/env python3
"""
📊 Análise em lote com o Agente IBGE

Executa automaticamente um conjunto de análises e
gera um relatório em Markdown com os resultados.

Uso:
  python analise_brasil.py
  python analise_brasil.py --output relatorio.md
"""

import asyncio
import json
import os
import subprocess
import sys
import time
from datetime import datetime

import anthropic

# Importa o cliente MCP e o agente do arquivo principal
sys.path.insert(0, os.path.dirname(__file__))
from agente_ibge import MCPClient, AgenteIBGE, MCP_SERVER_PATH, ANTHROPIC_API_KEY, MODEL

# ─── Análises a executar ──────────────────────────────────────────────────────

ANALISES = [
    {
        "titulo": "🏆 Ranking Populacional",
        "pergunta": "Liste os 10 estados mais populosos do Brasil com número de habitantes e percentual do total, segundo o Censo 2022.",
    },
    {
        "titulo": "📍 Densidade Demográfica",
        "pergunta": "Quais são os 5 estados com maior e os 5 com menor densidade demográfica no Brasil? Compare-os.",
    },
    {
        "titulo": "💰 Panorama Econômico",
        "pergunta": "Me dê o panorama econômico atual do Brasil: inflação IPCA dos últimos 6 meses, taxa de desemprego e rendimento médio.",
    },
    {
        "titulo": "🗺️ Regiões do Brasil",
        "pergunta": "Quantos municípios e estados cada região do Brasil possui? Apresente em formato de tabela.",
    },
    {
        "titulo": "🌆 Grandes Centros",
        "pergunta": "Busque a população das capitais: São Paulo, Rio de Janeiro, Belo Horizonte, Salvador e Fortaleza. Qual é a maior e a menor?",
    },
]


async def executar_analises(output_file: str | None = None) -> None:
    """Executa todas as análises e opcionalmente salva em arquivo."""

    if not ANTHROPIC_API_KEY:
        print("❌ ANTHROPIC_API_KEY não configurada!")
        sys.exit(1)

    print("🚀 Iniciando análise do Brasil com dados IBGE...")
    print(f"📅 {datetime.now().strftime('%d/%m/%Y %H:%M')}\n")

    # Iniciar MCP server
    mcp = MCPClient(MCP_SERVER_PATH)
    try:
        mcp.start()
        tools = mcp.list_tools()
        print(f"✅ Servidor MCP conectado ({len(tools)} ferramentas)\n")
        print("─" * 60)
    except Exception as e:
        print(f"❌ Erro ao iniciar servidor: {e}")
        sys.exit(1)

    agente = AgenteIBGE(mcp, tools)

    resultados = []
    inicio_total = time.time()

    for i, analise in enumerate(ANALISES, 1):
        print(f"\n[{i}/{len(ANALISES)}] {analise['titulo']}")
        print(f"❓ {analise['pergunta']}")
        print()

        inicio = time.time()
        try:
            resposta = agente.perguntar(analise["pergunta"])
            duracao = time.time() - inicio
            print(f"\n✅ Concluído em {duracao:.1f}s")
            print("\n" + resposta[:300] + ("..." if len(resposta) > 300 else ""))
            resultados.append({
                "titulo": analise["titulo"],
                "pergunta": analise["pergunta"],
                "resposta": resposta,
                "duracao": duracao,
                "sucesso": True,
            })
        except Exception as e:
            duracao = time.time() - inicio
            print(f"\n❌ Erro: {e}")
            resultados.append({
                "titulo": analise["titulo"],
                "pergunta": analise["pergunta"],
                "resposta": f"Erro: {e}",
                "duracao": duracao,
                "sucesso": False,
            })

        print("─" * 60)

        # Pequena pausa entre análises para evitar rate limit
        if i < len(ANALISES):
            await asyncio.sleep(1)

    mcp.stop()

    duracao_total = time.time() - inicio_total
    sucessos = sum(1 for r in resultados if r["sucesso"])

    print(f"\n📊 Resumo: {sucessos}/{len(ANALISES)} análises bem-sucedidas em {duracao_total:.1f}s")

    # Gerar relatório Markdown
    relatorio = gerar_relatorio(resultados, duracao_total)

    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(relatorio)
        print(f"💾 Relatório salvo em: {output_file}")
    else:
        print("\n" + "═" * 60)
        print(relatorio)


def gerar_relatorio(resultados: list[dict], duracao_total: float) -> str:
    """Gera relatório Markdown com todos os resultados."""
    linhas = [
        "# 🇧🇷 Relatório de Análise do Brasil — IBGE",
        f"\n_Gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')} | "
        f"Fonte: IBGE APIs | Powered by Claude_\n",
        "---\n",
    ]

    for i, r in enumerate(resultados, 1):
        linhas.append(f"## {i}. {r['titulo']}\n")
        linhas.append(f"> **Pergunta:** {r['pergunta']}\n")
        if r["sucesso"]:
            linhas.append(r["resposta"])
        else:
            linhas.append(f"⚠️ {r['resposta']}")
        linhas.append(f"\n_Tempo de resposta: {r['duracao']:.1f}s_\n")
        linhas.append("---\n")

    sucessos = sum(1 for r in resultados if r["sucesso"])
    linhas.append(
        f"_Análise completa: {sucessos}/{len(resultados)} bem-sucedidas | "
        f"Tempo total: {duracao_total:.1f}s_"
    )

    return "\n".join(linhas)


if __name__ == "__main__":
    output = None
    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output = sys.argv[idx + 1]

    asyncio.run(executar_analises(output))
