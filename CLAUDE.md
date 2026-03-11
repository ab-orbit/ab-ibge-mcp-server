# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **MCP (Model Context Protocol) server** that provides AI agents access to Brazil's IBGE (Instituto Brasileiro de Geografia e Estatística) public APIs. The server exposes 22+ tools covering demographic, economic, and geographic data through a standardized MCP interface.

Published as: `ab-ibge-mcp-server` on npm registry.

## Essential Commands

```bash
# Development
npm run dev          # Run server with ts-node (for testing)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled server from dist/

# Testing the server locally
node dist/index.js   # Should output: "✅ IBGE MCP Server iniciado — 22+ ferramentas disponíveis"

# Publishing updates
npm run build && npm version patch && npm publish  # Bug fixes (1.0.0 → 1.0.1)
npm run build && npm version minor && npm publish  # New features (1.0.0 → 1.1.0)
npm run build && npm version major && npm publish  # Breaking changes (1.0.0 → 2.0.0)
```

## Architecture

### Core Structure

```
src/
├── index.ts              # MCP server initialization and tool registration
├── types.ts              # TypeScript interfaces for IBGE API responses
├── services/
│   └── ibge-client.ts    # Centralized HTTP client with error handling
└── tools/                # MCP tool implementations (one file per domain)
    ├── localidades.ts    # Regions, states, municipalities (143 lines)
    ├── sidra.ts          # SIDRA system - statistical tables (582 lines)
    ├── censo.ts          # Census 2022 data (165 lines)
    ├── indicadores.ts    # Economic indicators (88 lines)
    ├── malha-noticias.ts # Geographic mesh & news (188 lines)
    └── cnae.ts           # Economic activity classification (385 lines)
```

### Key Design Patterns

**1. Tool Registration Pattern**
- Each tool file exports a `register*Tools(server: McpServer)` function
- All tools are registered in `src/index.ts` during server initialization
- Tools use Zod schemas for input validation
- All tools return `ToolResponse` with consistent error handling

**2. Centralized API Client** (`services/ibge-client.ts`)
- `ibgeFetch<T>(url: string)`: HTTP client with 15s timeout, JSON parsing, error handling
- `IBGEApiError`: Custom error class with status codes and endpoint tracking
- `formatToolError(err)`: Standardized error formatting for tool responses
- `truncateIfNeeded(text, maxChars)`: Prevents response overflow (default 50k chars)
- `IBGE_API` constant: Base URLs for IBGE API versions (v1, v2, v3)

**3. SIDRA Query Builder** (`tools/sidra.ts`)
- SIDRA is IBGE's main statistical database system
- Uses special notation: `N1[all]` (Brazil), `N3[all]` (states), `N6[all]` (municipalities)
- `CATALOGO_TEMAS`: Keyword-based table discovery in Portuguese (maps terms like "inflação" → table IDs)
- Complex queries require understanding SIDRA's hierarchical structure (variables, periods, localities, classifications)

## IBGE API Endpoints

```typescript
// Base URLs defined in services/ibge-client.ts
const IBGE_API = {
  v1: "https://servicodados.ibge.gov.br/api/v1",  // Localities
  v2: "https://servicodados.ibge.gov.br/api/v2",  // Geographic mesh
  v3: "https://servicodados.ibge.gov.br/api/v3",  // SIDRA, news
}
```

All IBGE APIs are:
- Public (no authentication required)
- JSON-based
- Free with no rate limits
- Official government data sources

## Adding New Tools

When implementing a new IBGE API tool:

1. **Create tool file** in `src/tools/`:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IBGE_API, ibgeFetch, formatToolError } from "../services/ibge-client.js";
import type { ToolResponse } from "../types.js";

export function registerYourTools(server: McpServer): void {
  server.registerTool(
    "ibge_tool_name",
    {
      title: "User-facing title",
      description: "Detailed description with args and return format",
      inputSchema: z.object({ /* zod schema */ }),
      annotations: {
        readOnlyHint: true,      // All IBGE tools are read-only
        destructiveHint: false,  // Never destructive
        idempotentHint: true,    // Same query = same result
        openWorldHint: false     // Closed API schema
      },
    },
    async (args): Promise<ToolResponse> => {
      try {
        const data = await ibgeFetch(`${IBGE_API.v1}/endpoint`);
        return { content: [{ type: "text", text: "formatted result" }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );
}
```

2. **Add types** to `src/types.ts` if needed for the API response structure

3. **Register in** `src/index.ts`:
```typescript
import { registerYourTools } from "./tools/your-tools.js";
// ...
registerYourTools(server);
```

4. **Update version and publish**:
```bash
npm run build
npm version minor  # New tool = minor version bump
npm publish
```

## SIDRA System Details

SIDRA (Sistema IBGE de Recuperação Automática) is the most complex component:

**Table Discovery Flow:**
1. User searches by keyword → `ibge_sidra_pesquisar_tabelas`
2. Get table metadata → `ibge_sidra_metadados_tabela` (shows available variables, periods, locations)
3. Query specific data → `ibge_sidra_consultar_tabela` with SIDRA notation

**SIDRA Notation:**
- Localities: `N1[1]` (Brazil), `N3[35]` (SP state), `N6[3550308]` (São Paulo city)
- Periods: `202301-202312` (2023 full year), `last` (most recent)
- Variables: numeric IDs from metadata (e.g., `63` = IPCA monthly variation)

**Pre-built wrappers** in `sidra.ts`:
- `ibge_ipca`: IPCA inflation with automatic period handling
- `ibge_pib_municipios`: GDP by municipality with educational indicators logic

## Error Handling Philosophy

- Always use try/catch in tool implementations
- Network errors → return formatted error message (never throw)
- Timeouts → 15 seconds max per request
- Large responses → auto-truncate at 50k chars with explanatory message
- Invalid IDs → let IBGE API return 404, format the error message

## Common Gotchas

1. **File extensions**: All imports use `.js` extension even though source is `.ts` (ESM requirement)
2. **Shebang**: `dist/index.js` must have `#!/usr/bin/env node` for global install to work
3. **SIDRA locality codes**: Municipality codes are 7 digits (e.g., 3550308), state codes are 2 digits (e.g., 35)
4. **Tool naming**: All tools prefixed with `ibge_` for namespace clarity
5. **npm bin field**: Package has `bin` field pointing to `dist/index.js` for global CLI usage

## Package Publishing Workflow

This package is published to npm as `ab-ibge-mcp-server`. Key files for publishing:
- `package.json`: Contains `bin` field for global installation
- `.npmignore`: Excludes `src/`, tests, and dev files
- `LICENSE`: MIT license
- `README.md`: User-facing documentation

Always ensure `dist/` is built before publishing (handled by `prepublishOnly` script).