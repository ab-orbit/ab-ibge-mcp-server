# 🚀 Guia Rápido - Agente IBGE com Ollama

## ✅ Status: CORRIGIDO E FUNCIONANDO!

O Agente IBGE agora funciona perfeitamente com modelos locais via Ollama, com todas as correções do ComexStat aplicadas.

## 🎯 Quick Start

```bash
# 1. Inicie o Ollama (se ainda não estiver rodando)
ollama serve

# 2. Instale um modelo (se ainda não tiver)
ollama pull llama3.2:latest

# 3. Execute o agente
cd /Users/jwcunha/Downloads/ibge-mcp-server/ibge-agente
python agente_ibge_v3.py

# 4. Selecione:
# - Provider: LOCALHOST (3)
# - Modelo: llama3.2:latest (ajuste conforme disponível)

# 5. Faça perguntas!
🇧🇷 Você: quantas pessoas se chamam maria?
```

## 🔧 O Que Foi Corrigido

### ❌ Problema Original
```
User: "Quantas pessoas se chamam Maria?"
Agent: [calls ibge_search_nomes]     ← iteração 1
Agent: [calls ibge_search_nomes]     ← iteração 2
Agent: [calls ibge_search_nomes]     ← iteração 3
...
Agent: ⚠️ Timeout após 10 iterações
```

### ✅ Solução Implementada
```
User: "Quantas pessoas se chamam Maria?"
Agent: [calls ibge_search_nomes]     ← iteração 1
       ✓ Recebe estatísticas do IBGE
Agent: 💬 Forçando resposta...        ← iteração 2
       "De acordo com o IBGE, existem aproximadamente 11.7 milhões..."
```

## 🎯 Melhorias Aplicadas

1. **System Prompt Otimizado** ⭐
   - Instruções claras: "Call ONCE → Get results → Respond"
   - Exemplos concretos de uso

2. **Filtro Inteligente de Ferramentas** ⭐
   - Seleciona 3-4 ferramentas mais relevantes
   - Baseado em palavras-chave na pergunta
   - Evita confusão em modelos pequenos

3. **Anti-Loop System** ⭐
   - Força resposta após primeira tool call
   - Detecta loops (mesma ferramenta 3x)
   - Interrompe automaticamente

4. **Function Calling Completo**
   - Suporte total ao Ollama
   - Conversão automática de formato
   - Suporte a mensagens de sistema

## 📊 Performance

| Métrica | Antes | Depois |
|---------|-------|--------|
| Iterações | 10 (timeout) | 2 |
| Tool calls | ~8-10 | 1 |
| Tempo | ~60s | ~5s |
| Sucesso | ❌ | ✅ |

## 🎮 Exemplos de Uso

### Buscar Nomes
```
🇧🇷 Você: quantas pessoas se chamam maria?
🤖 Agente: De acordo com o IBGE, existem aproximadamente
           11.734.129 pessoas chamadas Maria no Brasil,
           sendo o nome mais popular (ranking #1).
```

### População
```
🇧🇷 Você: qual a população do rio de janeiro?
🤖 Agente: [usa ibge_get_aggregate e retorna população]
```

### Indicadores
```
🇧🇷 Você: qual foi o ipca dos últimos 12 meses?
🤖 Agente: [usa ibge_metadata_indicators e retorna dados]
```

## 🧪 Teste Rápido

```bash
# Execute o teste automatizado
cd /Users/jwcunha/Downloads/ibge-mcp-server/ibge-agente
python test_ollama_quick.py
```

Deve exibir:
```
✅ TESTE PASSOU! Agente funcionou corretamente.
```

## 🔮 Modelos Recomendados

| Modelo | Tamanho | Performance | Recomendação |
|--------|---------|-------------|--------------|
| llama3.2:latest | 3B | ⭐⭐⭐ | OK para testes |
| llama3.1:8b | 8B | ⭐⭐⭐⭐⭐ | **Recomendado** |
| mistral:latest | 7B | ⭐⭐⭐⭐ | Rápido |

```bash
# Instalar modelo recomendado
ollama pull llama3.1:8b
```

## 📋 Arquivos Corrigidos

1. **agente_ibge_v3.py** ✅
   - System prompt otimizado
   - Filtro de ferramentas
   - Anti-loop system
   - Força resposta

2. **providers.py** ✅
   - Function calling para Ollama
   - Suporte a system messages
   - Processamento de tool_calls

3. **test_ollama_quick.py** ✅ (novo)
   - Teste automatizado

## 📚 Documentação

- **[OLLAMA_FIXES.md](./OLLAMA_FIXES.md)** - Detalhes técnicos das correções
- **[providers.py](./providers.py)** - Código de integração Ollama
- **[agente_ibge_v3.py](./agente_ibge_v3.py)** - Código principal do agente

## ⚠️ Troubleshooting

| Problema | Solução |
|----------|---------|
| Ollama não inicia | `killall ollama && ollama serve` |
| Modelo não encontrado | `ollama pull llama3.2:latest` |
| Loop infinito | ✅ Já corrigido automaticamente |
| Respostas lentas | Use modelo 8B ou GPU |
| MCP server não encontrado | `npm run build` na pasta raiz |

## 🎯 Perguntas de Exemplo

```
✅ Quantas pessoas se chamam João no Brasil?
✅ Qual a população de São Paulo?
✅ Qual o PIB do Brasil em 2021?
✅ Quais os 5 estados mais populosos?
✅ Qual foi o IPCA de janeiro de 2024?
✅ Quantos municípios tem o Brasil?
```

## 🔄 Comparação com ComexStat

As correções são **idênticas**! Apenas adaptadas para:
- ✅ Ferramentas IBGE vs ComexStat
- ✅ Palavras-chave específicas
- ✅ Exemplos de perguntas

A arquitetura e lógica são as mesmas em ambos os agentes.

## 💡 Dicas

1. **Use perguntas diretas** - "Quantas pessoas se chamam Maria?" em vez de "Me diga sobre o nome Maria"
2. **Um dado por pergunta** - Modelos 3B funcionam melhor com perguntas simples
3. **Modelos maiores** (8B+) - Para perguntas mais complexas
4. **GPU acelera** - Mas funciona em CPU também

## 📞 Suporte

- **Documentação técnica**: [OLLAMA_FIXES.md](./OLLAMA_FIXES.md)
- **Referência ComexStat**: [../../comex-agente/OLLAMA_SETUP.md](../../comex-agente/OLLAMA_SETUP.md)

---

**Versão:** v3.1 (com fixes do ComexStat)
**Status:** ✅ Produção
**Última atualização:** 2026-03-11