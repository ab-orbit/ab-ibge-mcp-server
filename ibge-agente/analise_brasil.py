#!/usr/bin/env python3
"""
📊 Análise Completa do Brasil — IBGE MCP Server v2.0

Executa automaticamente um conjunto abrangente de análises cobrindo:
  ✨ v2.0: Nomes brasileiros (frequência histórica e rankings)
  ✨ v2.0: Estimativas populacionais anuais (2001-2024+)
  ✨ v2.0: PIB dos estados com rankings
  - População, território e densidade demográfica
  - Indicadores econômicos (IPCA, desemprego, rendimento)
  - Educação e alfabetização (Censo 2022)
  - Estrutura CNAE (Classificação Nacional de Atividades Econômicas)

Gera um relatório completo em Markdown com todos os resultados.

Uso:
  python analise_brasil.py
  python analise_brasil.py --output relatorio_brasil_2024.md
  python analise_brasil.py --secoes nomes,economia,pib
  python analise_brasil.py --rapido  (apenas análises essenciais)
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
    # ══════════════════════════════════════════════════════════════════════════
    # ✨ NOVIDADE v2.0: API de Nomes Brasileiros
    # ══════════════════════════════════════════════════════════════════════════
    {
        "secao": "nomes",
        "titulo": "👤 Nomes Mais Populares do Brasil",
        "pergunta": "Quais os 15 nomes mais populares do Brasil (considerando ambos os sexos)? Para cada um, mostre quantas pessoas têm esse nome.",
        "essencial": True,
    },
    {
        "secao": "nomes",
        "titulo": "👶 Nomes por Década",
        "pergunta": "Compare os 10 nomes masculinos mais populares da década de 1980, 1990, 2000 e 2010. Quais nomes se mantiveram no topo? Quais caíram?",
        "essencial": False,
    },
    {
        "secao": "nomes",
        "titulo": "👧 Ranking Feminino Regional",
        "pergunta": "Quais os 10 nomes femininos mais populares em cada região do Brasil (Norte, Nordeste, Sudeste, Sul, Centro-Oeste)? Há diferenças regionais marcantes?",
        "essencial": False,
    },
    {
        "secao": "nomes",
        "titulo": "📊 Evolução Histórica de Nomes Clássicos",
        "pergunta": "Analise a evolução de 1930 até 2010 dos nomes: Maria, José, João, Ana e Francisco. Mostre a frequência por década e identifique tendências.",
        "essencial": False,
    },

    # ══════════════════════════════════════════════════════════════════════════
    # ✨ NOVIDADE v2.0: Estimativas Populacionais
    # ══════════════════════════════════════════════════════════════════════════
    {
        "secao": "populacao",
        "titulo": "📈 População Atual do Brasil (2024)",
        "pergunta": "Qual a população estimada do Brasil em 2024? Compare com 2022 (Censo), 2020 e 2015. Qual foi o crescimento percentual em cada período?",
        "essencial": True,
    },
    {
        "secao": "populacao",
        "titulo": "📊 Projeção Populacional Estadual",
        "pergunta": "Quais os 10 estados mais populosos do Brasil em 2024 segundo estimativas? Compare com o Censo 2022. Houve mudanças no ranking?",
        "essencial": True,
    },
    {
        "secao": "populacao",
        "titulo": "🏆 Ranking Populacional Censo 2022",
        "pergunta": "Liste os 10 estados mais populosos do Brasil com número de habitantes e percentual do total, segundo o Censo 2022.",
        "essencial": True,
    },
    {
        "secao": "populacao",
        "titulo": "📍 Densidade Demográfica",
        "pergunta": "Quais são os 5 estados com maior e os 5 com menor densidade demográfica no Brasil? Compare-os em formato de tabela.",
        "essencial": False,
    },
    {
        "secao": "populacao",
        "titulo": "🌆 Capitais Brasileiras",
        "pergunta": "Busque a população das 10 maiores capitais do Brasil. Use 'Sao Paulo', 'Brasilia' e 'Goiania' sem acento para testar a busca flexível.",
        "essencial": False,
    },
    {
        "secao": "populacao",
        "titulo": "🗺️ População por Região",
        "pergunta": "Quantos habitantes cada região do Brasil possui segundo o Censo 2022? Apresente em tabela com percentual do total nacional.",
        "essencial": False,
    },

    # ══════════════════════════════════════════════════════════════════════════
    # ✨ NOVIDADE v2.0: PIB dos Estados
    # ══════════════════════════════════════════════════════════════════════════
    {
        "secao": "pib",
        "titulo": "💰 Ranking PIB Estadual 2021",
        "pergunta": "Qual o ranking completo de PIB dos estados brasileiros em 2021? Mostre valores em reais e participação percentual no PIB nacional.",
        "essencial": True,
    },
    {
        "secao": "pib",
        "titulo": "💵 PIB per Capita Regional",
        "pergunta": "Compare o PIB per capita de 2021 entre as regiões do Brasil. Calcule a média por região e identifique as desigualdades regionais.",
        "essencial": True,
    },
    {
        "secao": "pib",
        "titulo": "🏭 Concentração Econômica",
        "pergunta": "Quanto do PIB brasileiro está concentrado em SP, RJ e MG (os 3 maiores)? E nos 5 maiores estados? Use dados de 2021.",
        "essencial": False,
    },
    {
        "secao": "pib",
        "titulo": "📊 PIB Municipal - Top 10",
        "pergunta": "Quais os 10 municípios com maior PIB no Brasil? E os 10 com maior PIB per capita? Use os dados mais recentes disponíveis.",
        "essencial": False,
    },

    # ══════════════════════════════════════════════════════════════════════════
    # 📊 Economia e Indicadores
    # ══════════════════════════════════════════════════════════════════════════
    {
        "secao": "economia",
        "titulo": "💹 Panorama Econômico Atual",
        "pergunta": "Me dê o panorama econômico completo do Brasil: inflação IPCA dos últimos 12 meses, taxa de desemprego atual, rendimento médio mensal e variação anual.",
        "essencial": True,
    },
    {
        "secao": "economia",
        "titulo": "📈 Série Histórica IPCA",
        "pergunta": "Mostre a evolução do IPCA nos últimos 24 meses. Identifique os meses com maior e menor inflação. A tendência é de alta ou baixa?",
        "essencial": False,
    },
    {
        "secao": "economia",
        "titulo": "⚡ Indicadores Múltiplos",
        "pergunta": "Consulte simultaneamente IPCA e INPC dos últimos 6 meses usando multi-variável. Compare os dois índices de inflação.",
        "essencial": False,
    },

    # ══════════════════════════════════════════════════════════════════════════
    # 🎓 Educação e Alfabetização
    # ══════════════════════════════════════════════════════════════════════════
    {
        "secao": "educacao",
        "titulo": "🎓 Alfabetização por Região",
        "pergunta": "Compare a taxa de alfabetização (pessoas 15 anos ou mais) entre as 5 regiões do Brasil segundo o Censo 2022. Qual região tem menor índice?",
        "essencial": True,
    },
    {
        "secao": "educacao",
        "titulo": "🏆 Melhores Municípios em Educação",
        "pergunta": "Quais os 15 municípios do Brasil com maior taxa de alfabetização? Mostre estado, taxa e população de cada um.",
        "essencial": False,
    },
    {
        "secao": "educacao",
        "titulo": "📉 Desafios Educacionais",
        "pergunta": "Quais os 10 municípios com menor taxa de alfabetização no Brasil? Identifique padrões regionais e populacional.",
        "essencial": False,
    },

    # ══════════════════════════════════════════════════════════════════════════
    # 🏭 CNAE - Classificação de Atividades Econômicas
    # ══════════════════════════════════════════════════════════════════════════
    {
        "secao": "cnae",
        "titulo": "🏭 Estrutura Geral da CNAE",
        "pergunta": "Liste todas as 21 seções da CNAE com descrição resumida. Quantas divisões, grupos, classes e subclasses existem no total?",
        "essencial": False,
    },
    {
        "secao": "cnae",
        "titulo": "🛒 CNAE do Comércio",
        "pergunta": "Explique a seção G (Comércio). Dê exemplos de CNAEs para: supermercado, farmácia, posto de gasolina, loja de roupas e e-commerce.",
        "essencial": False,
    },
    {
        "secao": "cnae",
        "titulo": "💻 CNAE de Tecnologia",
        "pergunta": "Quais CNAEs para: desenvolvimento de software, consultoria em TI, SaaS, hosting e suporte técnico? Monte tabela comparativa.",
        "essencial": False,
    },
    {
        "secao": "cnae",
        "titulo": "🍽️ CNAE de Alimentação",
        "pergunta": "CNAEs do setor alimentação: restaurante, lanchonete, padaria, food truck, delivery e catering. Inclua códigos e hierarquia completa.",
        "essencial": False,
    },
    {
        "secao": "cnae",
        "titulo": "🏥 CNAE de Saúde",
        "pergunta": "Principais CNAEs de saúde: hospital, clínica, laboratório, farmácia, plano de saúde e home care. Mostre caminho hierárquico completo.",
        "essencial": False,
    },
]


async def executar_analises(
    output_file: str | None = None,
    secoes: list[str] | None = None,
    rapido: bool = False
) -> None:
    """Executa análises filtradas e opcionalmente salva em arquivo.

    Args:
        output_file: Caminho do arquivo de saída (Markdown)
        secoes: Lista de seções a executar (ex: ['nomes', 'pib', 'economia'])
        rapido: Se True, executa apenas análises essenciais
    """

    if not ANTHROPIC_API_KEY:
        print("❌ ANTHROPIC_API_KEY não configurada!")
        print("   Execute: export ANTHROPIC_API_KEY='sk-ant-...'")
        sys.exit(1)

    print("=" * 70)
    print("🇧🇷 ANÁLISE COMPLETA DO BRASIL — IBGE MCP SERVER v2.0")
    print("=" * 70)
    print(f"📅 {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print()

    # Filtrar análises
    analises_filtradas = ANALISES

    if rapido:
        analises_filtradas = [a for a in ANALISES if a.get("essencial", False)]
        print("⚡ Modo RÁPIDO: Executando apenas análises essenciais")

    if secoes:
        analises_filtradas = [a for a in analises_filtradas if a.get("secao") in secoes]
        print(f"🎯 Seções selecionadas: {', '.join(secoes)}")

    print(f"📊 Total de análises: {len(analises_filtradas)}")
    print()

    # Iniciar MCP server
    print("Iniciando IBGE MCP Server v2.0...")
    mcp = MCPClient(MCP_SERVER_PATH)

    try:
        mcp.start()
        tools = mcp.list_tools()
        print(f"✅ Servidor MCP conectado ({len(tools)} ferramentas disponíveis)")
    except Exception as e:
        print(f"❌ Erro ao iniciar servidor: {e}")
        sys.exit(1)

    print()
    print("=" * 70)

    agente = AgenteIBGE(mcp, tools)

    resultados = []
    inicio_total = time.time()
    secao_atual = None

    for i, analise in enumerate(analises_filtradas, 1):
        # Cabeçalho de seção
        if analise.get("secao") != secao_atual:
            secao_atual = analise.get("secao")
            if secao_atual:
                secao_nome = {
                    "nomes": "👤 NOMES BRASILEIROS (v2.0)",
                    "populacao": "📊 POPULAÇÃO E TERRITÓRIO (v2.0)",
                    "pib": "💰 PIB E ECONOMIA REGIONAL (v2.0)",
                    "economia": "📈 INDICADORES ECONÔMICOS",
                    "educacao": "🎓 EDUCAÇÃO E ALFABETIZAÇÃO",
                    "cnae": "🏭 CLASSIFICAÇÃO DE ATIVIDADES (CNAE)",
                }.get(secao_atual, secao_atual.upper())
                print(f"\n{'=' * 70}")
                print(f"📂 {secao_nome}")
                print("=" * 70)

        print(f"\n[{i}/{len(analises_filtradas)}] {analise['titulo']}")
        print(f"❓ {analise['pergunta']}")
        print()

        inicio = time.time()
        try:
            resposta = agente.perguntar(analise["pergunta"])
            duracao = time.time() - inicio

            # Preview da resposta
            preview = resposta[:250].replace("\n", " ")
            print(f"\n✅ Concluído em {duracao:.2f}s")
            print(f"📄 {preview}{'...' if len(resposta) > 250 else ''}")

            resultados.append({
                "secao": analise.get("secao", "geral"),
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
                "secao": analise.get("secao", "geral"),
                "titulo": analise["titulo"],
                "pergunta": analise["pergunta"],
                "resposta": f"⚠️ Erro: {e}",
                "duracao": duracao,
                "sucesso": False,
            })

        print("-" * 70)

        # Pequena pausa entre análises para evitar rate limit
        if i < len(analises_filtradas):
            await asyncio.sleep(0.5)

    mcp.stop()

    duracao_total = time.time() - inicio_total
    sucessos = sum(1 for r in resultados if r["sucesso"])

    print()
    print("=" * 70)
    print("📊 RESUMO DA ANÁLISE")
    print("=" * 70)
    print(f"✅ Sucessos: {sucessos}/{len(analises_filtradas)} ({sucessos/len(analises_filtradas)*100:.1f}%)")
    print(f"⏱️  Tempo total: {duracao_total:.1f}s")
    print(f"⚡ Média por análise: {duracao_total/len(analises_filtradas):.2f}s")
    print()

    # Estatísticas por seção
    secoes_stats = {}
    for r in resultados:
        secao = r.get("secao", "geral")
        if secao not in secoes_stats:
            secoes_stats[secao] = {"total": 0, "sucessos": 0, "tempo": 0}
        secoes_stats[secao]["total"] += 1
        if r["sucesso"]:
            secoes_stats[secao]["sucessos"] += 1
        secoes_stats[secao]["tempo"] += r["duracao"]

    if secoes_stats:
        print("Resultados por seção:")
        for secao, stats in secoes_stats.items():
            print(f"  {secao}: {stats['sucessos']}/{stats['total']} ({stats['tempo']:.1f}s)")
        print()

    # Gerar relatório Markdown
    relatorio = gerar_relatorio(resultados, duracao_total, sucessos, rapido)

    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(relatorio)
        print(f"💾 Relatório salvo em: {output_file}")
        print(f"   Visualize com: open {output_file}")
    else:
        print("\n" + "=" * 70)
        print(relatorio[:1000] + "\n...\n(Use --output para salvar o relatório completo)")


def gerar_relatorio(resultados: list[dict], duracao_total: float, sucessos: int, rapido: bool) -> str:
    """Gera relatório Markdown com todos os resultados da v2.0."""
    modo = "RÁPIDO (apenas essenciais)" if rapido else "COMPLETO"

    linhas = [
        "# 🇧🇷 Análise Completa do Brasil — IBGE MCP Server v2.0",
        "",
        f"_Gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')} | Modo: {modo}_",
        "",
        "## 📋 Resumo Executivo",
        "",
        f"- **Versão do servidor:** 2.0.0",
        f"- **Total de análises:** {len(resultados)}",
        f"- **Sucessos:** {sucessos}/{len(resultados)} ({sucessos/len(resultados)*100:.1f}%)",
        f"- **Tempo total:** {duracao_total:.1f}s",
        f"- **Média por análise:** {duracao_total/len(resultados):.2f}s",
        "",
        "## ✨ Novidades v2.0 Utilizadas",
        "",
        "1. 👤 **API de Nomes** - Frequência histórica e rankings de nomes brasileiros",
        "2. 📊 **Estimativas Populacionais** - Dados anuais 2001-2024+ (preenche gaps entre censos)",
        "3. 💰 **PIB dos Estados** - Rankings estaduais com participação nacional",
        "4. 🔍 **Busca sem Acentos** - Normalização automática (ex: 'Sao Paulo' → 'São Paulo')",
        "5. ⚡ **Cache Inteligente** - Respostas instantâneas para dados repetidos",
        "6. 🎯 **Multi-variável SIDRA** - Consultas combinadas em uma chamada",
        "",
        "---",
        "",
    ]

    secao_atual = None

    for i, r in enumerate(resultados, 1):
        # Cabeçalho de seção
        if r.get("secao") != secao_atual:
            secao_atual = r.get("secao")
            if secao_atual:
                secao_nome = {
                    "nomes": "👤 Nomes Brasileiros (v2.0)",
                    "populacao": "📊 População e Território (v2.0)",
                    "pib": "💰 PIB e Economia Regional (v2.0)",
                    "economia": "📈 Indicadores Econômicos",
                    "educacao": "🎓 Educação e Alfabetização",
                    "cnae": "🏭 Classificação de Atividades (CNAE)",
                }.get(secao_atual, secao_atual.title())
                linhas.append(f"## {secao_nome}")
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

    linhas.append("## 📊 Conclusão")
    linhas.append("")
    linhas.append(f"Análise completa do Brasil realizada com **{sucessos}/{len(resultados)}** consultas bem-sucedidas.")
    linhas.append("")
    linhas.append("---")
    linhas.append("")
    linhas.append(f"_Relatório gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')}_")
    linhas.append("")
    linhas.append("_Powered by IBGE APIs Oficiais + Claude Opus 4.5_")

    return "\n".join(linhas)


if __name__ == "__main__":
    output = None
    secoes_filter = None
    rapido_mode = False

    # Parse argumentos
    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output = sys.argv[idx + 1]
        else:
            output = f"relatorio_brasil_{datetime.now().strftime('%Y%m%d_%H%M')}.md"

    if "--secoes" in sys.argv:
        idx = sys.argv.index("--secoes")
        if idx + 1 < len(sys.argv):
            secoes_filter = sys.argv[idx + 1].split(",")

    if "--rapido" in sys.argv:
        rapido_mode = True

    # Mostrar ajuda se pedido
    if "--help" in sys.argv or "-h" in sys.argv:
        print("""
🇧🇷 Análise Completa do Brasil — IBGE MCP Server v2.0

Uso:
  python analise_brasil.py [opções]

Opções:
  --output ARQUIVO     Salva relatório em arquivo Markdown (padrão: relatorio_brasil_YYYYMMDD_HHMM.md)
  --secoes LISTA       Executa apenas seções especificadas (ex: nomes,pib,economia)
  --rapido             Executa apenas análises marcadas como essenciais (modo rápido)
  --help, -h           Mostra esta ajuda

Seções disponíveis:
  nomes       - API de Nomes (frequência e rankings)
  populacao   - População e Território (Censo + Estimativas)
  pib         - PIB dos Estados
  economia    - Indicadores Econômicos (IPCA, desemprego, etc.)
  educacao    - Alfabetização e Educação
  cnae        - Classificação de Atividades Econômicas

Exemplos:
  python analise_brasil.py
  python analise_brasil.py --rapido
  python analise_brasil.py --output meu_relatorio.md
  python analise_brasil.py --secoes nomes,pib --output economia_2024.md
        """)
        sys.exit(0)

    asyncio.run(executar_analises(output, secoes_filter, rapido_mode))
