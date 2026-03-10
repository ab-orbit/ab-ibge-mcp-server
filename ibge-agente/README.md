# 🇧🇷 Agente IBGE — Exemplo de uso com MCP

Agente de IA que combina **Claude** + **IBGE MCP Server** para responder
perguntas complexas sobre dados do Brasil com raciocínio em múltiplos passos.

## 📁 Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `agente_ibge.py` | **Chat interativo** — faça perguntas em tempo real |
| `analise_brasil.py` | **Análise em lote** — executa múltiplas análises e gera relatório |
| `requirements.txt` | Dependências Python |

## 🚀 Instalação

```bash
# 1. Instale a dependência Python
pip install anthropic

# 2. Configure sua API key da Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# 3. (Se necessário) Ajuste o caminho do servidor MCP
export IBGE_MCP_PATH="/caminho/para/ibge-mcp-server/dist/index.js"
```

## 💬 Modo Interativo (Chat)

```bash
python agente_ibge.py
```

```
╔══════════════════════════════════════════════════════════╗
║           🇧🇷  Agente IBGE  —  Powered by Claude         ║
║   Responde perguntas sobre dados do Brasil em tempo real  ║
╚══════════════════════════════════════════════════════════╝

  17 ferramentas IBGE carregadas

  Comandos especiais:
    /exemplos    — mostra perguntas de exemplo
    /limpar      — reinicia o histórico da conversa
    /ferramentas — lista as ferramentas disponíveis
    /sair        — encerra o agente

  🇧🇷 Você: Qual o estado mais populoso do Brasil?

  ⚙️  Processando...

  📡 Buscando dados (1/10):
    🔧 ibge_populacao_estados()
       ↳ ## População por Estado — Censo 2022...

  🤖 Agente:
  ## Estado mais populoso do Brasil

  **São Paulo** é o estado mais populoso, com **44.420.459 habitantes**,
  representando **21,7% da população total** do Brasil...
```

### Exemplos de perguntas

```
Qual o estado mais populoso do Brasil?
Compare a densidade demográfica de SP, RJ e MG
Qual foi a inflação nos últimos 12 meses?
Quais municípios de PE têm 'Caruaru' no nome?
Me dê um panorama econômico do Brasil
Qual a diferença entre o Nordeste e o Sul em população?
```

## 📊 Análise em Lote

```bash
# Executa 5 análises e exibe no terminal
python analise_brasil.py

# Salva relatório em Markdown
python analise_brasil.py --output relatorio_brasil.md
```

## 🔄 Como funciona o loop do agente

```
Pergunta do usuário
      │
      ▼
 Claude recebe pergunta + 17 ferramentas IBGE disponíveis
      │
      ├─► Claude decide chamar ibge_populacao_estados()
      │         │
      │         ▼
      │   Resultado da API IBGE retorna dados reais
      │         │
      ├─► Claude analisa e pode chamar mais ferramentas
      │   (ex: ibge_pib_estados() para correlação)
      │         │
      ▼
 Claude formula resposta final com os dados coletados
      │
      ▼
 Resposta apresentada ao usuário com formatação clara
```

## 🧠 O que torna isso um "agente"?

1. **Raciocínio em múltiplos passos**: Claude pode fazer 10+ chamadas de ferramentas
2. **Memória de contexto**: A conversa é mantida entre perguntas
3. **Decisão autônoma**: Claude decide QUAIS ferramentas usar e em que ordem
4. **Tratamento de erros**: Se uma ferramenta falha, Claude tenta outra abordagem

## 📚 Ferramentas MCP disponíveis

O agente tem acesso a 17 ferramentas do IBGE:

**Localidades:** estados, municípios, regiões, buscas geográficas
**Censo 2022:** população por município, estado, ranking nacional, densidade
**Econômicos:** IPCA, INPC, desemprego (PNAD), rendimento médio
**SIDRA:** acesso a qualquer tabela do sistema IBGE de estatísticas
**Outros:** malha geográfica, notícias e releases do IBGE
