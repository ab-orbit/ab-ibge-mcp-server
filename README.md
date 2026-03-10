# 🇧🇷 IBGE MCP Server

Servidor MCP (Model Context Protocol) para as **APIs públicas do IBGE**, permitindo que agentes de IA como Claude acessem dados estatísticos, geográficos e econômicos do Brasil em tempo real.

## ✨ Ferramentas Disponíveis (17 tools)

### 📍 Localidades
| Tool | Descrição |
|------|-----------|
| `ibge_listar_regioes` | Lista as 5 regiões geográficas com seus estados |
| `ibge_listar_estados` | Lista todos os 27 estados com sigla, ID e região |
| `ibge_listar_municipios` | Lista municípios de um estado (com busca por nome) |
| `ibge_buscar_municipio` | Busca município por ID IBGE (7 dígitos) |

### 📊 SIDRA (Sistema de Recuperação Automática)
| Tool | Descrição |
|------|-----------|
| `ibge_sidra_pesquisar_tabelas` | Pesquisa tabelas por assunto (ex: "PIB", "agricultura") |
| `ibge_sidra_metadados_tabela` | Metadados de uma tabela (variáveis, períodos, localidades) |
| `ibge_sidra_consultar_tabela` | Consulta dados de qualquer tabela SIDRA |
| `ibge_ipca` | Inflação IPCA mensal com série histórica |
| `ibge_pib_municipios` | PIB dos municípios ou estados |

### 📈 Indicadores Econômicos
| Tool | Descrição |
|------|-----------|
| `ibge_indicador_economico` | IPCA, IPCA acumulado, desemprego, rendimento, INPC |
| `ibge_listar_indicadores` | Lista todos os indicadores disponíveis |

### 👥 Censo Demográfico 2022
| Tool | Descrição |
|------|-----------|
| `ibge_populacao_municipio` | População de um município pelo Censo 2022 |
| `ibge_populacao_estados` | Ranking de população de todos os estados |
| `ibge_densidade_demografica` | Densidade demográfica (hab/km²) por estado |
| `ibge_populacao_censo2022` | Dados populacionais do Censo com filtros avançados |

### 🗺️ Malha e Notícias
| Tool | Descrição |
|------|-----------|
| `ibge_malha_geografica` | URL da malha geográfica (GeoJSON/SVG) |
| `ibge_noticias` | Notícias e releases do IBGE |

## 🚀 Instalação

```bash
# 1. Clone ou copie o projeto
cd ibge-mcp-server

# 2. Instale as dependências
npm install

# 3. Compile o TypeScript
npm run build

# 4. Teste o servidor
node dist/index.js
```

## ⚙️ Configuração no Claude Desktop

Edite `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) ou
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "ibge": {
      "command": "node",
      "args": ["/caminho/para/ibge-mcp-server/dist/index.js"]
    }
  }
}
```

Reinicie o Claude Desktop. O ícone 🔌 aparecerá indicando que o servidor está conectado.

## 💡 Exemplos de Uso com Agentes IA

```
Usuário: "Qual o estado mais populoso do Brasil?"
Agente: ibge_populacao_estados() → São Paulo com 44,4 milhões de habitantes (21,7% do total)

Usuário: "Compare a inflação de 2023 e 2024 mês a mês"
Agente: ibge_indicador_economico(indicador="IPCA", periodos="202301-202412")

Usuário: "Liste todas as cidades de SC com 'Floriano' no nome"
Agente: ibge_listar_municipios(uf="SC", busca="Floriano")

Usuário: "Qual a densidade demográfica do DF vs SP?"
Agente: ibge_densidade_demografica() → DF: 529.2 hab/km², SP: 177.3 hab/km²

Usuário: "Me dê dados de PIB dos estados do Nordeste"
Agente: ibge_sidra_consultar_tabela(tabela="5938", localidades="N3[21,22,23,24,25,26,27,28,29]")
```

## 🔧 Tecnologias

- **TypeScript** com tipagem estrita
- **MCP SDK** (@modelcontextprotocol/sdk)
- **APIs do IBGE** — 100% públicas, sem autenticação necessária
- **Zod** para validação de inputs

## 📚 APIs do IBGE Utilizadas

| API | Versão | Endpoint Base |
|-----|--------|---------------|
| Localidades | v1 | `servicodados.ibge.gov.br/api/v1/localidades` |
| SIDRA | v3 | `servicodados.ibge.gov.br/api/v3/agregados` |
| Malha Geográfica | v2 | `servicodados.ibge.gov.br/api/v2/malhas` |
| Notícias | v3 | `servicodados.ibge.gov.br/api/v3/noticias` |
