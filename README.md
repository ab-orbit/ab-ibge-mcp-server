# 🇧🇷 IBGE MCP Server

Servidor MCP (Model Context Protocol) para as **APIs públicas do IBGE**, permitindo que agentes de IA como Claude acessem dados estatísticos, geográficos e econômicos do Brasil em tempo real.

**✨ Versão 2.0.1** — Agora com cache inteligente, API de Nomes e suporte multi-variável!

---

**Sponsored by [Aeon Bridge Co.](https://aeonbridge.com)** 🌉
Building the future of AI-powered data integration.
Contact: [contact@aeonbridge.com](mailto:contact@aeonbridge.com)

---

## ✨ Ferramentas Disponíveis (27+ tools)

### 📍 Localidades
| Tool | Descrição |
|------|-----------|
| `ibge_listar_regioes` | Lista as 5 regiões geográficas com seus estados |
| `ibge_listar_estados` | Lista todos os 27 estados com sigla, ID e região |
| `ibge_listar_municipios` | Lista municípios de um estado (busca flexível sem acentos) |
| `ibge_buscar_municipio` | Busca município por nome em todo Brasil (suporta "Sao Paulo") |

### 📊 SIDRA (Sistema de Recuperação Automática)
| Tool | Descrição |
|------|-----------|
| `ibge_sidra_pesquisar_tabelas` | Pesquisa tabelas por assunto (ex: "PIB", "agricultura") |
| `ibge_sidra_metadados_tabela` | Metadados de uma tabela (variáveis, períodos, localidades) |
| `ibge_sidra_consultar_tabela` | Consulta dados com **múltiplas variáveis** simultaneamente |
| `ibge_periodos_tabela` | Lista períodos disponíveis de uma tabela |
| `ibge_ipca` | Inflação IPCA mensal com série histórica |
| `ibge_pib_municipios` | PIB dos municípios (tabela 5938) |
| `ibge_pib_estados` | **NOVO** — PIB dos estados com ranking nacional |

### 📈 Indicadores Econômicos
| Tool | Descrição |
|------|-----------|
| `ibge_indicador_economico` | IPCA, IPCA acumulado, desemprego, rendimento, INPC |
| `ibge_listar_indicadores` | Lista todos os indicadores disponíveis |

### 👥 Censo e População
| Tool | Descrição |
|------|-----------|
| `ibge_populacao_municipio` | População de um município pelo Censo 2022 |
| `ibge_populacao_estados` | Ranking de população de todos os estados |
| `ibge_densidade_demografica` | Densidade demográfica (hab/km²) por estado |
| `ibge_populacao_censo2022` | Dados populacionais do Censo com filtros avançados |
| `ibge_estimativas_populacionais` | **NOVO** — Estimativas anuais (2001-2024+) para municípios e estados |

### 🏷️ API de Nomes (Censo)
| Tool | Descrição |
|------|-----------|
| `ibge_nomes_frequencia` | **NOVO** — Frequência histórica de um nome (ex: "João") por década |
| `ibge_nomes_ranking` | **NOVO** — Top 20 nomes mais populares do Brasil ou por UF |

### 🗺️ Malha e Notícias
| Tool | Descrição |
|------|-----------|
| `ibge_malha_geografica` | URL da malha geográfica (GeoJSON/SVG) |
| `ibge_noticias` | Notícias e releases do IBGE |

## 🚀 Instalação

### Instalação via npm (Recomendado)

```bash
# Instale globalmente via npm
npm install -g ab-ibge-mcp-server
```

### Instalação manual (Desenvolvimento)

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

### Se instalou via npm global

Edite `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) ou
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "ibge": {
      "command": "ab-ibge-mcp-server"
    }
  }
}
```

### Se instalou manualmente

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

Usuário: "Quantas pessoas se chamam Maria no Brasil?"
Agente: ibge_nomes_frequencia(nome="Maria") → 11,7 milhões de pessoas registradas

Usuário: "Quais os nomes masculinos mais populares na década de 1990?"
Agente: ibge_nomes_ranking(sexo="M", decada=1990) → Top 20 com frequência

Usuário: "Qual o PIB de São Paulo em 2021?"
Agente: ibge_pib_estados(ano=2021, uf_id=35) → R$ 2,7 trilhões (31% do PIB nacional)

Usuário: "População estimada do Brasil em 2024"
Agente: ibge_estimativas_populacionais(ano=2024, localidade="BR") → 212,6 milhões

Usuário: "Compare inflação de 2023 e 2024 mês a mês"
Agente: ibge_indicador_economico(indicador="IPCA", periodos="202301-202412")

Usuário: "Liste todas as cidades de SC com 'Floriano' (sem acento)"
Agente: ibge_listar_municipios(uf="SC", busca="Floriano") → Florianópolis encontrada!

Usuário: "Busque 'Sao Paulo' (sem acento)"
Agente: ibge_buscar_municipio(nome="Sao Paulo") → São Paulo-SP encontrado (normalização automática)

Usuário: "Qual a densidade demográfica do DF vs SP?"
Agente: ibge_densidade_demografica() → DF: 529.2 hab/km², SP: 177.3 hab/km²

Usuário: "Consulte IPCA e INPC simultaneamente"
Agente: ibge_sidra_consultar_tabela(tabela="1419", variaveis="63|44") → Múltiplas variáveis em uma chamada
```

## 🔧 Tecnologias e Performance

- **TypeScript** com tipagem estrita
- **MCP SDK** (@modelcontextprotocol/sdk)
- **APIs do IBGE** — 100% públicas, sem autenticação necessária
- **Zod** para validação de inputs
- **Cache in-memory** com TTL inteligente (até 7 dias para dados imutáveis)
- **Retry automático** com exponential backoff para maior confiabilidade
- **Busca sem acentos** — aceita "Sao Paulo", "Florianopolis", etc.

## 📚 APIs do IBGE Utilizadas

| API | Versão | Endpoint Base |
|-----|--------|---------------|
| Localidades | v1 | `servicodados.ibge.gov.br/api/v1/localidades` |
| SIDRA | v3 | `servicodados.ibge.gov.br/api/v3/agregados` |
| Malha Geográfica | v2 | `servicodados.ibge.gov.br/api/v2/malhas` |
| Notícias | v3 | `servicodados.ibge.gov.br/api/v3/noticias` |

## 🤝 Sponsorship

This project is proudly **sponsored by [Aeon Bridge Co.](https://aeonbridge.com)** 🌉

Aeon Bridge Co. is a technology company focused on building innovative solutions for AI-powered data integration and intelligent systems. We bridge the gap between complex data sources and modern AI agents, making information accessible and actionable.

**Learn more:** [https://aeonbridge.com](https://aeonbridge.com)
**Contact:** [contact@aeonbridge.com](mailto:contact@aeonbridge.com)

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🙏 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

---

**Made with ❤️ by the Aeon Bridge team**
