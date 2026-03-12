# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [2.1.0] - 2026-03-12

### ✨ Adicionado

#### Nova API de Países (v1)
- `ibge_listar_paises` - Lista todos os 193 países do mundo com códigos ISO e localização
- `ibge_obter_pais` - Informações detalhadas de um país (área, capital, línguas, moeda, histórico)
- `ibge_buscar_pais` - Busca países por nome em português, inglês ou espanhol
- Suporte completo aos códigos ISO-3166-1-ALPHA-2/3 e M49
- Dados incluem: localização geográfica, línguas oficiais, moedas, histórico

### 📊 Estatísticas

- **Total de ferramentas**: 30+ (antes: 27+)
- **Novas ferramentas**: 3
- **Cobertura de APIs**: +1 endpoint do IBGE (Países v1)

## [2.0.2] - 2026-03-11

### 🐛 Corrigido

#### IPCA agora usa tabela 1737 com dados atualizados até 2026
- **Problema**: `ibge_ipca` retornava dados apenas até 2019 (tabela 1419 descontinuada)
- **Solução**: Migrado para tabela SIDRA 1737 (série histórica completa desde 1979)
- **Impacto**: Dados do IPCA agora incluem **janeiro/2026** e são atualizados mensalmente
- **Exemplo**: `ibge_ipca(ultimos_meses=12, tipo='variacao_acumulada_12_meses')` → dados de 2025/2026 ✅

## [2.0.1] - 2026-03-11

### 🐛 Corrigido

#### Erro HTTP 500 no IPCA Acumulado
- **Problema**: `ibge_ipca` retornava erro 500 ao consultar variação acumulada em 12 meses
- **Causa**: ID de variável incorreto na tabela SIDRA 1419 (usava `2266` em vez de `2265`)
- **Solução**: Corrigido mapeamento de variável para `variacao_acumulada_12_meses: "2265"`
- **Impacto**: Consultas de IPCA acumulado em 12 meses agora funcionam corretamente
- **Exemplo**: `ibge_ipca(ultimos_meses=12, tipo='variacao_acumulada_12_meses')` → ✅ OK
- **Referência**: Variável 2265 = "IPCA - Variação acumulada em 12 meses" (tabela IBGE 1419)

## [2.0.0] - 2026-03-10

### ✨ Adicionado

#### Nova API de Nomes (Census)
- `ibge_nomes_frequencia` - Consulta frequência histórica de nomes próprios por década desde 1930
- `ibge_nomes_ranking` - Top 20 nomes mais populares do Brasil ou por UF/década
- Suporte a filtros por sexo (M/F) e localidade

#### Novas Ferramentas de População e Economia
- `ibge_estimativas_populacionais` - Estimativas anuais de população (2001-2024+) para municípios e estados
- `ibge_pib_estados` - PIB total ou per capita dos estados com ranking nacional
- Dados preenchem gaps entre censos e fornecem informações mais recentes

#### Performance e Confiabilidade
- **Sistema de cache in-memory** com TTL inteligente:
  - Localidades: 24h (dados raramente mudam)
  - Nomes: 7 dias (dados do Censo, imutáveis)
  - SIDRA metadados: 6h
  - SIDRA dados: 1h (indicadores econômicos)
  - Notícias: 30min
- **Retry automático** com exponential backoff para requisições 503/504
- Timeout de 15s por requisição com até 3 tentativas

### 🔧 Melhorado

#### Busca Flexível sem Acentos
- `ibge_buscar_municipio` e `ibge_listar_municipios` agora normalizam acentos
- Aceita "Sao Paulo", "Florianopolis", "Brasilia" sem acentos
- Normalização NFD automática com remoção de diacríticos

#### Suporte Multi-variável no SIDRA
- `ibge_sidra_consultar_tabela` aceita múltiplas variáveis via pipe (ex: "63|44|93")
- Reduz latência ao buscar múltiplos indicadores simultaneamente
- Exemplo: IPCA + INPC em uma única chamada

#### Otimizações Gerais
- Todas as chamadas IBGE agora usam cache quando apropriado
- Redução de ~80% nas chamadas HTTP repetidas
- Respostas instantâneas (<1ms) para dados cacheados

### 📊 Estatísticas

- **Total de ferramentas**: 27+ (antes: 22)
- **Novas ferramentas**: 5
- **Melhorias**: 8
- **Cobertura de APIs**: +2 endpoints do IBGE (Nomes v2, Estimativas)

## [1.0.0] - 2026-03-10

### Adicionado
- Versão inicial com 22 ferramentas
- Suporte a Localidades (regiões, estados, municípios)
- SIDRA (pesquisa, metadados, consulta de tabelas)
- Indicadores econômicos (IPCA, desemprego, rendimento)
- Censo Demográfico 2022
- Malha geográfica e notícias
- CNAE (Classificação de Atividades Econômicas)
- Publicação no npm como `ab-ibge-mcp-server`