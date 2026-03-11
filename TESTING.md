# 🧪 IBGE MCP Server - Suite de Testes

## 📋 Visão Geral

Este projeto inclui uma suite completa de testes de integração que valida **todos os 27+ recursos** do servidor MCP IBGE. Os testes fazem chamadas reais às APIs públicas do IBGE e verificam a integridade das respostas.

## 🏗️ Estrutura de Testes

```
tests/
├── helpers/
│   └── test-utils.ts          # Utilitários e helpers para testes
└── integration/
    ├── localidades.test.ts    # Testes de regiões, estados e municípios (4 tools)
    ├── sidra.test.ts          # Testes do sistema SIDRA (7 tools)
    └── outros.test.ts         # Nomes, indicadores, censo, notícias, CNAE
```

## 🚀 Como Executar os Testes

### Pré-requisitos

```bash
# Instalar dependências (já feito durante npm install)
npm install
```

### Comandos de Teste

```bash
# Executar todos os testes (single run)
npm test

# Executar testes em modo watch (desenvolvimento)
npm run test:watch

# Executar testes com UI interativa
npm run test:ui

# Executar testes com relatório de cobertura
npm run test:coverage
```

## 📊 Cobertura de Testes

### ✅ Localidades (4 ferramentas)
- `ibge_listar_regioes` - Valida 5 regiões do Brasil
- `ibge_listar_estados` - Valida 27 estados + DF
- `ibge_listar_municipios` - Testa busca de municípios por estado
- `ibge_buscar_municipio` - Valida busca por ID e normalização de acentos

### ✅ SIDRA (7 ferramentas)
- `ibge_sidra_pesquisar_tabelas` - Busca de agregados por pesquisa
- `ibge_sidra_metadados_tabela` - Metadados de tabelas IPCA e Censo
- `ibge_periodos_tabela` - Períodos disponíveis
- `ibge_sidra_consultar_tabela` - Consultas Brasil, estados e múltiplas variáveis
- `ibge_ipca` - **Teste da correção do bug** (variável 2265 vs 2266)
- `ibge_pib_municipios` - PIB e PIB per capita
- `ibge_pib_estados` - Ranking de PIB estadual

### ✅ População e Censo (5 ferramentas)
- `ibge_populacao_censo2022` - População Brasil e estados
- `ibge_alfabetizacao_municipios` - Taxa de alfabetização das 27 capitais
- `ibge_estimativas_populacionais` - Estimativas anuais

### ✅ API de Nomes (2 ferramentas)
- `ibge_nomes_frequencia` - Frequência de nomes (Maria, João)
- `ibge_nomes_ranking` - Ranking nacional e por UF

### ✅ Indicadores Econômicos (2 ferramentas)
- `ibge_indicador_economico` - Listagem de indicadores disponíveis
- `ibge_listar_indicadores` - Validação de presença do IPCA

### ✅ Outros (6 ferramentas)
- `ibge_noticias` - Notícias e releases do IBGE
- `ibge_malha_geografica` - Informações de malha
- `ibge_cnae_pesquisar` - Classificação de atividades econômicas
- Performance e cache

## 🐛 Teste Específico da Correção do Bug

O arquivo `sidra.test.ts` inclui testes específicos para validar a correção do bug do IPCA:

```typescript
it("🐛 FIX: deve consultar IPCA acumulado 12 meses (variável 2265)", async () => {
  const dados = await ibgeFetch(
    `${IBGE_API.v3}/agregados/1419/periodos/last%2012/variaveis/2265?localidades=N1[all]`
  );
  expect(dados[0].variavel).toBe("IPCA - Variação acumulada em 12 meses");
  // ✅ Agora funciona!
});

it("❌ deve falhar com variável incorreta 2266 (bug antigo)", async () => {
  await expect(
    ibgeFetch(`...variaveis/2266...`)
  ).rejects.toThrow();
  // ❌ Confirma que a variável antiga não existe
});
```

## 📈 Helpers Disponíveis

### Validadores de Resposta

```typescript
import {
  expectValidToolResponse,  // Valida estrutura de resposta MCP
  expectNoError,             // Verifica ausência de erros
  expectHasData,             // Valida que há dados na resposta
  expectValidSidraResponse,  // Validação completa para SIDRA
  expectContains,            // Busca por padrão na resposta
  expectMarkdownTable,       // Valida formato de tabela markdown
} from "../helpers/test-utils.js";
```

### Códigos de Teste

```typescript
import { TEST_CODES, TEST_YEARS } from "../helpers/test-utils.js";

// Estados
TEST_CODES.SP  // "35" - São Paulo
TEST_CODES.RJ  // "33" - Rio de Janeiro
TEST_CODES.MG  // "31" - Minas Gerais
TEST_CODES.BA  // "29" - Bahia

// Municípios
TEST_CODES.SAO_PAULO       // "3550308"
TEST_CODES.RIO_JANEIRO     // "3304557"
TEST_CODES.BELO_HORIZONTE  // "3106200"
TEST_CODES.SALVADOR        // "2927408"
TEST_CODES.BRASILIA        // "5300108"

// Anos
TEST_YEARS.CENSO_2022   // "2022"
TEST_YEARS.PIB_RECENTE  // "2021"
```

## ⏱️ Performance

### Timeouts
- **Timeout padrão**: 30 segundos por teste
- **Pool strategy**: Forks com `singleFork: true` para evitar rate limiting
- **Delays**: `await delay(500)` entre testes que chamam o mesmo endpoint

### Otimizações
```typescript
// Evita rate limiting entre testes
import { delay } from "../helpers/test-utils.js";
await delay(500); // 500ms entre chamadas
```

## 📝 Exemplo de Teste Completo

```typescript
describe("IPCA - Inflação", () => {
  it("deve retornar IPCA dos últimos 12 meses", async () => {
    await delay(500); // Evita rate limiting

    const dados = await ibgeFetch<SidraResultado[]>(
      `${IBGE_API.v3}/agregados/1419/periodos/last%2012/variaveis/63?localidades=N1[all]`
    );

    // Validações básicas
    expect(dados).toBeDefined();
    expect(dados.length).toBeGreaterThan(0);

    // Validação de estrutura SIDRA
    const resultado = dados[0];
    expect(resultado).toHaveProperty("variavel");
    expect(resultado).toHaveProperty("unidade");
    expect(resultado.variavel).toContain("Variação mensal");

    // Validação de dados
    const serie = resultado.resultados[0].series[0].serie;
    expect(Object.keys(serie).length).toBe(12); // 12 meses

    // Validação de valores
    const valores = Object.values(serie).map((v) => parseFloat(v as string));
    valores.forEach((valor) => {
      expect(valor).toBeGreaterThan(-10); // Valores razoáveis
      expect(valor).toBeLessThan(50);
    });
  });
});
```

## 🎯 Testes Críticos

### 1. Correção do Bug IPCA
```bash
# Executar apenas testes SIDRA
npx vitest run sidra.test.ts

# Resultado esperado:
# ✓ 🐛 FIX: deve consultar IPCA acumulado 12 meses (variável 2265)
# ✓ ❌ deve falhar com variável incorreta 2266 (bug antigo)
```

### 2. Validação de Localidades
```bash
npx vitest run localidades.test.ts

# Verifica:
# - 5 regiões geográficas
# - 27 estados
# - Busca de municípios
# - Normalização de acentos
```

### 3. População Censo 2022
```bash
npx vitest run -t "população"

# Valida:
# - População do Brasil (>200M habitantes)
# - População dos estados
# - São Paulo como estado mais populoso
```

## 🔧 Configuração Vitest

O arquivo `vitest.config.ts` define:

```typescript
{
  testTimeout: 30000,        // 30s para chamadas API
  pool: "forks",             // Isolamento entre testes
  singleFork: true,          // Evita rate limiting
  coverage: {
    provider: "v8",
    reporter: ["text", "json", "html"],
  }
}
```

## 📊 Relatório de Cobertura

```bash
npm run test:coverage
```

Gera relatório em:
- `coverage/index.html` - Relatório visual
- `coverage/coverage-final.json` - Dados JSON
- Console - Resumo textual

## 🚨 Troubleshooting

### Timeouts
Se testes derem timeout:
```bash
# Aumentar timeout individualmente
it("teste demorado", async () => {
  // ...
}, 60000); // 60 segundos
```

### Rate Limiting
Se a API IBGE retornar muitos erros 429:
```typescript
// Aumentar delay entre testes
await delay(1000); // 1 segundo
```

### Falhas Intermitentes
APIs públicas podem ter instabilidade:
```bash
# Re-executar testes falhados
npm test -- --retry=2
```

## 📚 Recursos Adicionais

- [Vitest Documentation](https://vitest.dev/)
- [IBGE API Documentation](https://servicodados.ibge.gov.br/api/docs)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)

## ✅ Checklist de Testes

Antes de publicar uma nova versão:

- [ ] `npm test` - Todos os testes passando
- [ ] `npm run test:coverage` - Cobertura > 80%
- [ ] Teste do bug IPCA (variável 2265) passando ✅
- [ ] Testes de localidades (27 estados, 5 regiões)
- [ ] Testes SIDRA (múltiplas variáveis)
- [ ] Testes de normalização de acentos
- [ ] Performance < 10s para suite completa

---

**Última atualização:** 2026-03-11
**Versão do servidor:** 2.0.1
**Total de testes:** 40+
