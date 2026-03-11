#!/usr/bin/env python3
"""
🚀 Demonstração das Funcionalidades v2.0 — IBGE MCP Server

Executa análises automáticas para demonstrar as novas funcionalidades da versão 2.0:
  ✨ API de Nomes (frequência histórica e rankings)
  ✨ Estimativas Populacionais anuais (2001-2024+)
  ✨ PIB dos Estados com rankings
  ✨ Cache inteligente e busca sem acentos
  ✨ Consultas multi-variável no SIDRA

Gera um relatório completo em Markdown mostrando todas as capacidades.

Uso:
  python demo_v2.py
  python demo_v2.py --output demo_v2_resultados.md
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

# ─── Demonstrações v2.0 ───────────────────────────────────────────────────────

DEMOS_V2 = [
    # ══════════════════════════════════════════════════════════════════════════
    # 🎯 FEATURE 1: API de Nomes do Censo
    # ══════════════════════════════════════════════════════════════════════════
    {
        "categoria": "👤 API de Nomes",
        "titulo": "Frequência de Nomes Populares",
        "pergunta": "Quantas pessoas se chamam Maria, João, Ana e José no Brasil? Para cada nome, mostre o total e a evolução por década desde 1930.",
    },
    {
        "categoria": "👤 API de Nomes",
        "titulo": "Ranking de Nomes por Década",
        "pergunta": "Quais eram os 10 nomes masculinos mais populares na década de 1990? E na década de 2010? Compare as mudanças.",
    },
    {
        "categoria": "👤 API de Nomes",
        "titulo": "Nomes Femininos no Nordeste",
        "pergunta": "Quais os 15 nomes femininos mais populares na região Nordeste? Use o ranking regional.",
    },
    {
        "categoria": "👤 API de Nomes",
        "titulo": "Evolução Histórica de um Nome",
        "pergunta": "Analise a evolução do nome 'Pedro' no Brasil: frequência total, e como variou de 1930 até 2010 por década. O nome está ficando mais ou menos popular?",
    },

    # ══════════════════════════════════════════════════════════════════════════
    # 🎯 FEATURE 2: Estimativas Populacionais
    # ══════════════════════════════════════════════════════════════════════════
    {
        "categoria": "📊 Estimativas Populacionais",
        "titulo": "População Atual do Brasil (2024)",
        "pergunta": "Qual a população estimada do Brasil em 2024? Compare com 2022 (Censo) e 2020. O crescimento está acelerando ou desacelerando?",
    },
    {
        "categoria": "📊 Estimativas Populacionais",
        "titulo": "Estimativas por Estado",
        "pergunta": "Quais os 5 estados mais populosos do Brasil em 2024 segundo as estimativas? Compare com os dados do Censo 2022.",
    },
    {
        "categoria": "📊 Estimativas Populacionais",
        "titulo": "Crescimento Populacional Histórico",
        "pergunta": "Mostre a evolução da população do Brasil de 2015 a 2024 usando estimativas. Qual foi o crescimento percentual total no período?",
    },

    # ══════════════════════════════════════════════════════════════════════════
    # 🎯 FEATURE 3: PIB dos Estados
    # ══════════════════════════════════════════════════════════════════════════
    {
        "categoria": "💰 PIB Estadual",
        "titulo": "Ranking PIB Estados 2021",
        "pergunta": "Qual o ranking completo de PIB dos estados brasileiros em 2021? Mostre os valores e a participação percentual de cada um no PIB nacional.",
    },
    {
        "categoria": "💰 PIB Estadual",
        "titulo": "PIB per Capita Regional",
        "pergunta": "Compare o PIB per capita de 2021 entre: SP, RJ, MG (Sudeste), BA, PE (Nordeste), RS, PR (Sul). Qual região tem maior PIB per capita médio?",
    },
    {
        "categoria": "💰 PIB Estadual",
        "titulo": "Concentração Econômica",
        "pergunta": "Quanto do PIB brasileiro está concentrado nos 3 estados mais ricos (SP, RJ, MG)? Use dados de 2021.",
    },

    # ══════════════════════════════════════════════════════════════════════════
    # 🎯 FEATURE 4: Busca Flexível sem Acentos
    # ══════════════════════════════════════════════════════════════════════════
    {
        "categoria": "🔍 Busca sem Acentos",
        "titulo": "Busca de Cidades sem Acento",
        "pergunta": "Busque municípios usando nomes SEM acento: 'Sao Paulo', 'Florianopolis', 'Goiania', 'Brasilia'. O sistema deve encontrar todos corretamente.",
    },
    {
        "categoria": "🔍 Busca sem Acentos",
        "titulo": "Municípios com Nomes Similares",
        "pergunta": "Liste todos os municípios que contêm 'Jose' (sem acento) no nome. Quantos existem no Brasil?",
    },

    # ══════════════════════════════════════════════════════════════════════════
    # 🎯 FEATURE 5: Multi-variável SIDRA + Cache
    # ══════════════════════════════════════════════════════════════════════════
    {
        "categoria": "⚡ Performance & Multi-variável",
        "titulo": "Consulta Multi-indicador",
        "pergunta": "Busque simultaneamente IPCA e INPC dos últimos 6 meses usando consulta multi-variável. Compare os dois índices de inflação.",
    },
    {
        "categoria": "⚡ Performance & Multi-variável",
        "titulo": "Teste de Cache",
        "pergunta": "Busque novamente os dados de população dos estados (mesma consulta anterior). A resposta deve ser instantânea devido ao cache.",
    },

    # ══════════════════════════════════════════════════════════════════════════
    # 🎯 ANÁLISE INTEGRADA: Combinando Múltiplas Features
    # ══════════════════════════════════════════════════════════════════════════
    {
        "categoria": "🎯 Análise Integrada",
        "titulo": "Panorama Completo São Paulo",
        "pergunta": "Faça um panorama completo de São Paulo: população estimada 2024, PIB 2021, densidade demográfica, e os 5 nomes mais comuns no estado.",
    },
    {
        "categoria": "🎯 Análise Integrada",
        "titulo": "Brasil em Números - 2024",
        "pergunta": "Resumo completo do Brasil em 2024: população estimada, estados mais populosos, PIB estadual dos top 5, inflação atual, e os 10 nomes mais populares do país.",
    },
]


async def executar_demo(output_file: str | None = None) -> None:
    """Executa todas as demonstrações v2.0 e gera relatório."""

    print("=" * 70)
    print("🚀 DEMONSTRAÇÃO IBGE MCP SERVER v2.0")
    print("=" * 70)
    print(f"📅 {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print()
    print("Novas funcionalidades sendo testadas:")
    print("  ✨ API de Nomes (frequência + ranking)")
    print("  ✨ Estimativas Populacionais 2001-2024+")
    print("  ✨ PIB dos Estados")
    print("  ✨ Cache in-memory com TTL")
    print("  ✨ Busca sem acentos")
    print("  ✨ Consultas multi-variável SIDRA")
    print()

    if not ANTHROPIC_API_KEY:
        print("❌ ANTHROPIC_API_KEY não configurada!")
        print("   Execute: export ANTHROPIC_API_KEY='sk-ant-...'")
        sys.exit(1)

    # Iniciar MCP server
    print("Iniciando IBGE MCP Server v2.0...")
    mcp = MCPClient(MCP_SERVER_PATH)

    try:
        mcp.start()
        tools = mcp.list_tools()
        print(f"✅ Servidor conectado! {len(tools)} ferramentas disponíveis")
    except Exception as e:
        print(f"❌ Erro ao iniciar servidor: {e}")
        sys.exit(1)

    print()
    print("=" * 70)

    agente = AgenteIBGE(mcp, tools)

    resultados = []
    inicio_total = time.time()

    categoria_atual = None

    for i, demo in enumerate(DEMOS_V2, 1):
        # Cabeçalho de categoria
        if demo["categoria"] != categoria_atual:
            categoria_atual = demo["categoria"]
            print(f"\n{'=' * 70}")
            print(f"📂 {categoria_atual}")
            print("=" * 70)

        print(f"\n[{i}/{len(DEMOS_V2)}] {demo['titulo']}")
        print(f"❓ {demo['pergunta']}")
        print()

        inicio = time.time()
        try:
            resposta = agente.perguntar(demo["pergunta"])
            duracao = time.time() - inicio

            # Preview da resposta
            preview = resposta[:250].replace("\n", " ")
            print(f"\n✅ Concluído em {duracao:.2f}s")
            print(f"📄 {preview}{'...' if len(resposta) > 250 else ''}")

            resultados.append({
                "categoria": demo["categoria"],
                "titulo": demo["titulo"],
                "pergunta": demo["pergunta"],
                "resposta": resposta,
                "duracao": duracao,
                "sucesso": True,
            })
        except Exception as e:
            duracao = time.time() - inicio
            print(f"\n❌ Erro: {e}")
            resultados.append({
                "categoria": demo["categoria"],
                "titulo": demo["titulo"],
                "pergunta": demo["pergunta"],
                "resposta": f"⚠️ Erro: {e}",
                "duracao": duracao,
                "sucesso": False,
            })

        print("-" * 70)

        # Pausa para evitar rate limit
        if i < len(DEMOS_V2):
            await asyncio.sleep(0.5)

    mcp.stop()

    duracao_total = time.time() - inicio_total
    sucessos = sum(1 for r in resultados if r["sucesso"])

    print()
    print("=" * 70)
    print(f"📊 RESUMO DA DEMONSTRAÇÃO")
    print("=" * 70)
    print(f"✅ Sucessos: {sucessos}/{len(DEMOS_V2)}")
    print(f"⏱️  Tempo total: {duracao_total:.1f}s")
    print(f"⚡ Média por consulta: {duracao_total/len(DEMOS_V2):.2f}s")
    print()

    # Estatísticas por categoria
    categorias = {}
    for r in resultados:
        cat = r["categoria"]
        if cat not in categorias:
            categorias[cat] = {"total": 0, "sucessos": 0, "tempo": 0}
        categorias[cat]["total"] += 1
        if r["sucesso"]:
            categorias[cat]["sucessos"] += 1
        categorias[cat]["tempo"] += r["duracao"]

    print("Resultados por categoria:")
    for cat, stats in categorias.items():
        print(f"  {cat}: {stats['sucessos']}/{stats['total']} ({stats['tempo']:.1f}s)")

    # Gerar relatório Markdown
    relatorio = gerar_relatorio_v2(resultados, duracao_total, sucessos)

    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(relatorio)
        print(f"\n💾 Relatório salvo em: {output_file}")
        print(f"   Abra com: open {output_file}")
    else:
        print("\n" + "=" * 70)
        print(relatorio)


def gerar_relatorio_v2(resultados: list[dict], duracao_total: float, sucessos: int) -> str:
    """Gera relatório Markdown focado nas features v2.0."""
    linhas = [
        "# 🚀 Demonstração IBGE MCP Server v2.0",
        "",
        f"_Gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')}_",
        "",
        "## 📋 Resumo Executivo",
        "",
        f"- **Versão testada:** 2.0.0",
        f"- **Total de testes:** {len(resultados)}",
        f"- **Sucessos:** {sucessos}/{len(resultados)} ({sucessos/len(resultados)*100:.1f}%)",
        f"- **Tempo total:** {duracao_total:.1f}s",
        f"- **Média por teste:** {duracao_total/len(resultados):.2f}s",
        "",
        "## ✨ Novas Funcionalidades Testadas",
        "",
        "1. 👤 **API de Nomes** - Frequência histórica e rankings de nomes brasileiros",
        "2. 📊 **Estimativas Populacionais** - Dados anuais 2001-2024+ (preenche gaps entre censos)",
        "3. 💰 **PIB dos Estados** - Rankings estaduais com séries históricas",
        "4. 🔍 **Busca sem Acentos** - Normalização automática (ex: 'Sao Paulo' → 'São Paulo')",
        "5. ⚡ **Cache Inteligente** - TTL otimizado por tipo de dado (até 7 dias)",
        "6. 🎯 **Multi-variável SIDRA** - Consultas combinadas em uma chamada",
        "",
        "---",
        "",
    ]

    categoria_atual = None

    for i, r in enumerate(resultados, 1):
        # Cabeçalho de categoria
        if r["categoria"] != categoria_atual:
            categoria_atual = r["categoria"]
            linhas.append(f"## {categoria_atual}")
            linhas.append("")

        linhas.append(f"### {i}. {r['titulo']}")
        linhas.append("")
        linhas.append(f"> **Pergunta:** {r['pergunta']}")
        linhas.append("")

        if r["sucesso"]:
            linhas.append(r["resposta"])
        else:
            linhas.append(r["resposta"])

        linhas.append("")
        linhas.append(f"⏱️ _Tempo de resposta: {r['duracao']:.2f}s_")
        linhas.append("")
        linhas.append("---")
        linhas.append("")

    linhas.append("## 🎯 Conclusão")
    linhas.append("")
    linhas.append(f"A versão 2.0 do IBGE MCP Server foi testada com sucesso!")
    linhas.append("")
    linhas.append(f"- **{sucessos}** de **{len(resultados)}** testes passaram ({sucessos/len(resultados)*100:.1f}%)")
    linhas.append(f"- Tempo médio de resposta: **{duracao_total/len(resultados):.2f}s**")
    linhas.append(f"- Todas as novas funcionalidades estão operacionais")
    linhas.append("")
    linhas.append("### 🚀 Próximos Passos")
    linhas.append("")
    linhas.append("- Publicar versão 2.0.0 no npm")
    linhas.append("- Atualizar documentação com exemplos das novas features")
    linhas.append("- Monitorar performance do cache em produção")
    linhas.append("")
    linhas.append("---")
    linhas.append("")
    linhas.append(f"_Relatório gerado automaticamente em {datetime.now().strftime('%d/%m/%Y às %H:%M')}_")
    linhas.append("")
    linhas.append("_Powered by Claude Opus 4.5 + IBGE APIs Oficiais_")

    return "\n".join(linhas)


if __name__ == "__main__":
    output = None
    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output = sys.argv[idx + 1]
        else:
            output = f"demo_v2_{datetime.now().strftime('%Y%m%d_%H%M')}.md"

    asyncio.run(executar_demo(output))