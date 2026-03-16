# Plano de Implementação: Suporte HTTP para MCP Server IBGE

## Status: EM ANDAMENTO
Data de início: 2026-03-13

---

## Objetivo
Adicionar suporte HTTP/SSE ao servidor MCP IBGE mantendo compatibilidade com modo stdio atual (Dual Mode).

---

## Checklist de Implementação

### 1. Instalação de Dependências
- [ ] Instalar `express` (servidor HTTP)
- [ ] Instalar `cors` (CORS middleware)
- [ ] Instalar `@types/express` (dev dependency - já instalado)
- [ ] Instalar `@types/cors` (dev dependency)

**Comando:**
```bash
npm install express cors
npm install -D @types/cors
```

---

### 2. Modificar src/index.ts (Dual Transport Mode)

**Arquivo:** `src/index.ts`

**Mudanças:**
- Importar `express` e `SSEServerTransport`
- Criar função para detectar modo (stdio vs http)
- Implementar lógica condicional no `main()`
- Adicionar endpoint `/sse` para conexões HTTP
- Manter backward compatibility com stdio

**Código a adicionar:**
```typescript
import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// Função principal modificada para suportar dual mode
async function main(): Promise<void> {
  const mode = process.env.MCP_TRANSPORT || "stdio";

  if (mode === "http") {
    const app = express();
    const port = parseInt(process.env.PORT || "3000");

    app.use(cors());
    app.use(express.json());

    app.post("/sse", async (req, res) => {
      const transport = new SSEServerTransport("/message", res);
      await server.connect(transport);
    });

    app.get("/health", (req, res) => {
      res.json({ status: "ok", tools: 32 });
    });

    app.listen(port, () => {
      console.error(`✅ IBGE MCP Server (HTTP) — http://localhost:${port}`);
    });
  } else {
    // Modo stdio original (padrão)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("✅ IBGE MCP Server (stdio) — 32 ferramentas disponíveis");
  }
}
```

---

### 3. Atualizar package.json

**Arquivo:** `package.json`

**Mudanças:**
- Adicionar scripts para modo HTTP
- Documentar variáveis de ambiente
- Atualizar versão (minor bump: 2.1.0 → 2.2.0)

**Scripts a adicionar:**
```json
"scripts": {
  "start:http": "MCP_TRANSPORT=http PORT=3000 node dist/index.js",
  "dev:http": "MCP_TRANSPORT=http PORT=3000 ts-node src/index.ts"
}
```

**Dependências finais esperadas:**
```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.12.0",
  "cors": "^x.x.x",
  "express": "^4.x.x",
  "zod": "^3.23.8"
}
```

---

### 4. Criar Documentação HTTP

**Arquivo:** `HTTP_MODE.md` (novo)

**Conteúdo:**
- Como usar modo HTTP
- Variáveis de ambiente (MCP_TRANSPORT, PORT)
- Exemplos de cliente HTTP
- Comparação stdio vs HTTP
- Casos de uso
- Deploy em cloud (Railway, Render, Fly.io)

---

### 5. Atualizar README.md

**Arquivo:** `README.md`

**Seções a adicionar:**
- Menção ao suporte HTTP/SSE
- Link para HTTP_MODE.md
- Tabela comparativa de modos
- Exemplos de uso HTTP

---

### 6. Testes

#### 6.1 Teste Modo stdio (Regressão)
```bash
npm run build
npm start
# Deve exibir: ✅ IBGE MCP Server (stdio) — 32 ferramentas disponíveis
```

#### 6.2 Teste Modo HTTP
```bash
npm run build
npm run start:http
# Deve exibir: ✅ IBGE MCP Server (HTTP) — http://localhost:3000

# Em outro terminal:
curl http://localhost:3000/health
# Deve retornar: {"status":"ok","tools":32}
```

#### 6.3 Teste Cliente MCP via HTTP
- Criar script de teste usando MCP SDK client
- Testar conexão SSE
- Testar chamada de tool via HTTP

---

### 7. Build e Publicação

**Quando tudo estiver testado:**

```bash
# Build
npm run build

# Testar build
node dist/index.js  # stdio mode
MCP_TRANSPORT=http PORT=3000 node dist/index.js  # http mode

# Bump version
npm version minor  # 2.1.0 → 2.2.0

# Publicar
npm publish
```

---

## Variáveis de Ambiente

| Variável | Valores | Padrão | Descrição |
|----------|---------|--------|-----------|
| `MCP_TRANSPORT` | `stdio`, `http` | `stdio` | Modo de transporte |
| `PORT` | `1024-65535` | `3000` | Porta HTTP (só em modo http) |

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Breaking change em stdio | Baixa | Alto | Manter stdio como default, testar regressão |
| Dependências aumentam tamanho | Média | Baixo | Express é leve (~500KB), aceitável |
| SSE não funciona em alguns ambientes | Média | Médio | Documentar limitações, fallback para stdio |

---

## Próximos Passos (Futuro)

- [ ] Adicionar autenticação (API keys)
- [ ] Implementar rate limiting
- [ ] Adicionar métricas/observabilidade
- [ ] Docker image oficial
- [ ] Deploy exemplo no Railway/Render
- [ ] WebSocket transport (alternativa ao SSE)

---

## Notas de Desenvolvimento

### SSE (Server-Sent Events) vs WebSocket
- SSE é unidirecional (servidor → cliente)
- MCP SDK usa SSE + POST para comunicação bidirecional
- Endpoint `/sse` recebe conexão
- Endpoint `/message` recebe mensagens do cliente

### Compatibilidade
- Node.js >= 18.0.0 (já requerido)
- MCP SDK >= 1.12.0 (suporta SSE)
- Browsers modernos (SSE é Web standard)

---

## Status das Tarefas

- [ ] 1. Instalação de dependências
- [ ] 2. Modificar src/index.ts
- [ ] 3. Atualizar package.json
- [ ] 4. Criar HTTP_MODE.md
- [ ] 5. Atualizar README.md
- [ ] 6. Executar testes
- [ ] 7. Build e publicação

---

**Última atualização:** 2026-03-13
**Responsável:** Claude Code
**Versão alvo:** 2.2.0
