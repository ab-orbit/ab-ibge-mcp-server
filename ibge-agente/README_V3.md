# 🇧🇷 Agente IBGE v3 — Multiprovider Edition

Versão avançada do agente IBGE com suporte a **múltiplos provedores de LLM**:
- **Anthropic Claude** (Opus 4.5, Sonnet 4.5, Haiku)
- **OpenAI GPT** (GPT-4o, GPT-4 Turbo, o1/o3)
- **Google Gemini** (Gemini 2.0 Flash, Gemini 1.5 Pro)
- **Localhost** (Ollama, LM Studio, modelos locais)

## ✨ Novidades v3

### 🎯 Seleção Interativa de Provider
- Detecta automaticamente providers configurados
- Lista modelos disponíveis para cada provider
- Destaca modelos recomendados com ⭐
- Interface amigável com cores e navegação numérica

### 🔄 Conversão Automática de Formatos
- Converte ferramentas MCP para formato nativo de cada provider
- Normaliza respostas para estrutura unificada
- Suporte a tool calling em OpenAI e Anthropic
- Fallback para text-only em Gemini e modelos locais

### 🛡️ Resiliência Melhorada
- Bloqueia ferramentas com falhas recorrentes (≥3 falhas)
- Retry automático após erros temporários
- Limite de iterações configurável (padrão: 10)
- Tratamento de erros específico por provider

## 📦 Instalação

### 1. Compilar o Servidor MCP

```bash
cd /Users/jwcunha/Downloads/ibge-mcp-server
npm run build
```

### 2. Instalar Dependências Python

```bash
cd ibge-agente
pip install -r requirements.txt
```

## 🔑 Configuração de API Keys

Configure **pelo menos um** dos seguintes providers:

### Anthropic Claude
```bash
export ANTHROPIC_API_KEY='sk-ant-...'
```

### OpenAI GPT
```bash
export OPENAI_API_KEY='sk-...'
```

### Google Gemini
```bash
export GOOGLE_API_KEY='...'
# ou
export GEMINI_API_KEY='...'
```

### Localhost (Ollama/LM Studio)
```bash
# Ollama: http://localhost:11434 (padrão)
ollama serve

# LM Studio: http://localhost:1234
# Inicie LM Studio e carregue um modelo
```

## 🚀 Uso

### Modo Interativo (Recomendado)

```bash
python agente_ibge_v3.py
```

Siga os passos:
1. **Escolha o provider** (Anthropic, OpenAI, Gemini, Localhost)
2. **Escolha o modelo** (lista automática dos disponíveis)
3. **Faça perguntas** sobre dados do IBGE

### Exemplo de Sessão

```
╔══════════════════════════════════════════════════════════╗
║    🇧🇷  Agente IBGE  —  Configuração Interativa        ║
╚══════════════════════════════════════════════════════════╝

📋 Verificando providers configurados...

✅ Providers disponíveis:

  1. ANTHROPIC (5 modelos)
  2. OPENAI (8 modelos)
  3. GEMINI (5 modelos)

Escolha o provider [1]: 1

✅ Provider selecionado: ANTHROPIC

📋 Listando modelos disponíveis...

✅ Modelos disponíveis:

⭐ 1. claude-opus-4-5-20251101
⭐ 2. claude-sonnet-4-5-20250929
   3. claude-opus-4-20250514
   4. claude-3-5-sonnet-20241022
   5. claude-3-5-haiku-20241022

Escolha o modelo [1]: 2

✅ Modelo selecionado: claude-sonnet-4-5-20250929

────────────────────────────────────────────────────────

🤖 Provider: ANTHROPIC
📦 Modelo: claude-sonnet-4-5-20250929

────────────────────────────────────────────────────────

Digite suas perguntas sobre dados oficiais do Brasil (IBGE).
Digite 'sair' para encerrar.

✅ Servidor IBGE MCP iniciado

💡 Exemplos de perguntas:
  • Quantas pessoas se chamam Maria no Brasil?
  • Qual a população do Rio de Janeiro em 2024?
  • Qual foi o IPCA dos últimos 12 meses?
  • Quais os 5 estados mais populosos?
  • Qual o PIB de São Paulo em 2021?

🇧🇷 Você: Qual a população do Brasil em 2024?

  ⚙️  Processando...

  📡 Buscando dados IBGE (1/10):
  🔧 ibge_estimativas_populacionais(ano=2024, localidade='BR')
     ↳ ## Brasil — Estimativa 2024...

  🤖 Agente:
  A população estimada do Brasil em 2024 é de 212.583.750 habitantes.
```

## 🎯 Perguntas de Exemplo

### 👤 Nomes e Demografia
```
• Quantas pessoas se chamam Pedro no Brasil?
• Quais os nomes masculinos mais populares na década de 1990?
• Qual a evolução do nome Maria desde 1930?
• Ranking dos 15 nomes femininos no Nordeste
```

### 📊 População e Censos
```
• Qual a população do Rio de Janeiro em 2024?
• Compare a população dos 5 estados mais populosos
• Densidade demográfica do Distrito Federal
• População de São Paulo (município) em 2022
```

### 💰 Economia e PIB
```
• Qual o PIB de São Paulo em 2021?
• Ranking dos estados por PIB per capita
• Concentração do PIB nos 3 estados mais ricos
• PIB dos municípios de Minas Gerais
```

### 📈 Indicadores Econômicos
```
• Qual foi o IPCA dos últimos 12 meses?
• Compare IPCA e INPC nos últimos 6 meses
• Taxa de desemprego atual
• Rendimento médio per capita
```

### 🗺️ Geografia e Localidades
```
• Busque municípios com nome "Sao Paulo" (sem acento)
• Liste todos os estados da região Sul
• Municípios da região metropolitana de Brasília
• Quantos municípios existem no Brasil?
```

## 🔧 Arquitetura Multiprovider

### Classes Principais

```python
# providers.py

class LLMProvider(ABC):
    """Classe abstrata base para todos os providers"""
    - list_models() → List[str]
    - create_message() → Response
    - format_response() → Dict

class AnthropicProvider(LLMProvider):
    """Provider Claude (tool calling nativo)"""

class OpenAIProvider(LLMProvider):
    """Provider GPT (conversão de tools para function calling)"""

class GeminiProvider(LLMProvider):
    """Provider Gemini (text-only por enquanto)"""

class LocalhostProvider(LLMProvider):
    """Provider Ollama/LM Studio (APIs compatíveis)"""
```

### Factory Functions

```python
# Criar provider específico
provider = get_provider("anthropic", "claude-sonnet-4-5-20250929")

# Listar todos os providers configurados
all_providers = list_all_providers()
# → {"anthropic": [...], "openai": [...]}
```

## 📊 Comparação de Providers

| Provider | Tool Calling | Custo | Velocidade | Uso Recomendado |
|----------|-------------|-------|------------|-----------------|
| **Claude Sonnet 4.5** | ✅ Nativo | Médio | Rápida | **Produção** (melhor custo/benefício) |
| **Claude Opus 4.5** | ✅ Nativo | Alto | Moderada | Análises complexas |
| **GPT-4o** | ✅ Convertido | Médio | Rápida | Alternativa ao Claude |
| **Gemini 2.0 Flash** | ⚠️ Limitado | Baixo | Muito rápida | Testes, prototipagem |
| **Ollama (local)** | ❌ Sem tools | Grátis | Variável | Desenvolvimento offline |

## 🐛 Troubleshooting

### "Nenhum provider configurado"
```bash
# Verifique se alguma API key está configurada
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY
echo $GOOGLE_API_KEY

# Configure pelo menos uma:
export ANTHROPIC_API_KEY='sua-chave-aqui'
```

### "Servidor MCP não encontrado"
```bash
# Compile o servidor MCP
cd ..  # Voltar para a raiz do projeto
npm run build

# Ou configure o caminho manualmente
export IBGE_MCP_PATH='/caminho/completo/para/dist/index.js'
```

### "Erro ao chamar o LLM"
- **Rate limit**: Aguarde alguns segundos entre requisições
- **Token limit**: Use modelos com maior contexto (Claude Opus, GPT-4)
- **API key inválida**: Verifique se a chave está correta e ativa

### Ferramentas Bloqueadas
```
⛔ Bloqueando tools com muitas falhas: ['ibge_tool_name']
```
- Reinicie o agente (ferramentas são desbloqueadas)
- Verifique se o servidor MCP está atualizado (`npm run build`)
- Reporte o erro no GitHub Issues

## 📝 Contribuindo

### Adicionar Novo Provider

1. Crie classe em `providers.py`:
```python
class MeuProvider(LLMProvider):
    def _get_default_api_key(self) -> Optional[str]:
        return os.getenv("MEU_API_KEY")

    def list_models(self) -> List[str]:
        return ["modelo-1", "modelo-2"]

    def create_message(self, messages, max_tokens, tools):
        # Implementar chamada à API
        pass

    def format_response(self, response):
        # Normalizar resposta
        pass
```

2. Adicione ao factory `get_provider()`:
```python
elif provider_name == "meuprovider":
    return MeuProvider(model or "modelo-default", api_key)
```

3. Adicione ao `list_all_providers()`:
```python
if os.getenv("MEU_API_KEY"):
    provider = MeuProvider()
    providers["meuprovider"] = provider.list_models()
```

## 📚 Recursos

- [Anthropic Claude API](https://docs.anthropic.com/)
- [OpenAI API](https://platform.openai.com/docs)
- [Google Gemini API](https://ai.google.dev/docs)
- [Ollama](https://ollama.ai/)
- [LM Studio](https://lmstudio.ai/)

## 🆘 Suporte

- **Issues**: [GitHub Issues](https://github.com/anthropics/claude-code/issues)
- **Docs**: Ver arquivos demo_v2.py e analise_brasil.py para exemplos
- **MCP Spec**: [Model Context Protocol](https://modelcontextprotocol.io/)

---

**Desenvolvido com ❤️ usando Claude Code**
**Dados oficiais: IBGE (Instituto Brasileiro de Geografia e Estatística)**
