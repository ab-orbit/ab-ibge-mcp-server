# Modo HTTP - IBGE MCP Server

O IBGE MCP Server suporta dois modos de transporte:
- **stdio** (padrão): Comunicação via stdin/stdout para uso local
- **http**: Servidor HTTP com SSE (Server-Sent Events) para acesso remoto

---

## Quick Start

### Modo stdio (padrão)
```bash
npm start
# ou
node dist/index.js
```

### Modo HTTP
```bash
npm run start:http
# ou
MCP_TRANSPORT=http PORT=3000 node dist/index.js
```

---

## Variáveis de Ambiente

| Variável | Valores | Padrão | Descrição |
|----------|---------|--------|-----------|
| `MCP_TRANSPORT` | `stdio` \| `http` | `stdio` | Modo de transporte |
| `PORT` | `1024-65535` | `3000` | Porta HTTP (apenas em modo http) |

---

## Endpoints HTTP

### Health Check
```bash
GET http://localhost:3000/health
```

**Resposta:**
```json
{
  "status": "ok",
  "name": "ibge-mcp-server",
  "version": "2.2.0",
  "tools": 32,
  "mode": "http"
}
```

### SSE (MCP Connection)
```bash
POST http://localhost:3000/sse
```

Este é o endpoint usado pelo MCP SDK client para estabelecer conexão via Server-Sent Events.

---

## Cliente MCP via HTTP

### Exemplo com MCP SDK (TypeScript)

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("http://localhost:3000/sse")
);

const client = new Client({
  name: "meu-cliente",
  version: "1.0.0"
}, {
  capabilities: {}
});

await client.connect(transport);

// Listar ferramentas disponíveis
const tools = await client.listTools();
console.log(tools);

// Chamar uma ferramenta
const result = await client.callTool({
  name: "ibge_uf",
  arguments: { sigla: "SP" }
});
console.log(result);
```

### Exemplo com cURL (teste básico)

```bash
# Health check
curl http://localhost:3000/health

# SSE connection (requer MCP client completo)
curl -X POST http://localhost:3000/sse \
  -H "Content-Type: application/json"
```

---

## Comparação: stdio vs HTTP

| Aspecto | stdio | HTTP |
|---------|-------|------|
| **Uso** | Local apenas | Local ou remoto |
| **Clientes** | 1 por processo | Múltiplos simultâneos |
| **Latência** | ~1ms | ~50-200ms |
| **Segurança** | Isolado | Requer autenticação |
| **Deploy** | Não aplicável | Cloud, containers |
| **Casos de uso** | Claude Desktop, CLI | Web apps, APIs |

---

## Casos de Uso

### Use stdio quando:
- Usar com Claude Desktop
- Executar scripts locais
- Desenvolvimento e testes
- Segurança e latência são críticas

### Use HTTP quando:
- Múltiplos clientes precisam acessar simultaneamente
- Deploy em cloud (AWS, Google Cloud, etc.)
- Integração com aplicações web
- Acesso remoto necessário

---

## Deploy em Cloud

### Railway

```bash
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm run start:http"

[env]
MCP_TRANSPORT = "http"
PORT = "${{PORT}}"
```

Deploy:
```bash
railway login
railway init
railway up
```

### Render

```yaml
# render.yaml
services:
  - type: web
    name: ibge-mcp-server
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm run start:http
    envVars:
      - key: MCP_TRANSPORT
        value: http
      - key: PORT
        fromGroup: web
```

### Fly.io

```bash
# fly.toml
app = "ibge-mcp-server"

[env]
  MCP_TRANSPORT = "http"
  PORT = "8080"

[[services]]
  http_checks = []
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

Deploy:
```bash
fly launch
fly deploy
```

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist ./dist

ENV MCP_TRANSPORT=http
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start:http"]
```

Build e run:
```bash
docker build -t ibge-mcp-server .
docker run -p 3000:3000 ibge-mcp-server
```

---

## Segurança (Recomendações)

O modo HTTP básico **não inclui autenticação**. Para produção, considere:

### 1. API Key Middleware
```typescript
// Adicionar em src/index.ts
app.use((req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (process.env.REQUIRE_API_KEY && apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});
```

### 2. Rate Limiting
```bash
npm install express-rate-limit
```

```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máx 100 requests
});

app.use(limiter);
```

### 3. HTTPS
Use reverse proxy (nginx, Caddy) ou serviços cloud que fornecem SSL automático.

---

## Troubleshooting

### Erro: "Port already in use"
```bash
# Encontrar processo usando a porta
lsof -i :3000
# Matar processo
kill -9 <PID>
# Ou usar outra porta
PORT=3001 npm run start:http
```

### CORS Error em navegadores
O servidor já inclui `cors()` middleware. Se ainda tiver problemas:
```typescript
app.use(cors({
  origin: "http://seu-dominio.com",
  credentials: true
}));
```

### SSE Connection Timeout
Alguns proxies/load balancers têm timeout curto para SSE. Configure:
- nginx: `proxy_read_timeout 3600s;`
- AWS ALB: Increase idle timeout to 300s

---

## Performance

### Benchmarks (aproximados)
- **stdio**: ~1ms latência local
- **HTTP localhost**: ~10-50ms
- **HTTP LAN**: ~50-150ms
- **HTTP cloud**: ~100-500ms (+ latência IBGE API)

### Otimizações
- Use HTTP/2 para múltiplas conexões
- Implemente caching de respostas IBGE
- Use CDN para deploy global
- Monitore com observability tools (Datadog, New Relic)

---

## Roadmap

Funcionalidades futuras planejadas:
- [ ] Autenticação JWT/OAuth2
- [ ] Rate limiting por usuário
- [ ] Métricas e observabilidade
- [ ] WebSocket transport (alternativa ao SSE)
- [ ] Caching integrado (Redis)
- [ ] Docker image oficial no Docker Hub

---

## Suporte

- Issues: https://github.com/seu-usuario/ibge-mcp-server/issues
- Documentação MCP SDK: https://modelcontextprotocol.io
- APIs IBGE: https://servicodados.ibge.gov.br