// Exemplo de implementação HTTP/SSE completa para MCP Server
// Baseado na documentação oficial do MCP SDK

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";

const server = new McpServer({
  name: "ibge-mcp-server",
  version: "2.2.0",
});

// Register tools aqui...

function createHttpApp(mcpServer) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      name: "ibge-mcp-server",
      version: "2.2.0",
      tools: 32,
      mode: "http"
    });
  });

  // ARQUITETURA MCP HTTP/SSE:
  // 1. Cliente faz GET /sse -> Inicia stream SSE
  // 2. Servidor envia evento "endpoint" com URL do /message
  // 3. Cliente envia mensagens MCP via POST /message
  // 4. Servidor responde via SSE stream

  // Store active transports by session
  const transports = new Map();

  // GET /sse - Inicia conexão SSE
  app.get("/sse", async (req, res) => {
    console.log("📡 New SSE connection");

    // Create unique session ID
    const sessionId = Math.random().toString(36).substring(7);

    try {
      // Create SSE transport with /message endpoint
      const transport = new SSEServerTransport(`/message/${sessionId}`, res);

      // Store transport for this session
      transports.set(sessionId, transport);

      // Connect MCP server to this transport
      await mcpServer.connect(transport);

      // Cleanup when connection closes
      res.on("close", () => {
        console.log(`🔌 SSE connection closed: ${sessionId}`);
        transports.delete(sessionId);
      });

    } catch (error) {
      console.error("SSE connection error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "SSE connection failed" });
      }
    }
  });

  // POST /message/:sessionId - Recebe mensagens MCP do cliente
  app.post("/message/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const transport = transports.get(sessionId);

    if (!transport) {
      return res.status(404).json({
        error: "Session not found",
        sessionId
      });
    }

    try {
      // O transport processa a mensagem internamente
      // e responde via SSE stream
      await transport.handlePostMessage(req, res);
    } catch (error) {
      console.error("Error handling message:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Message handling failed" });
      }
    }
  });

  return app;
}

// Start server
const app = createHttpApp(server);
const port = parseInt(process.env.PORT || "3000");

app.listen(port, () => {
  console.log(`✅ IBGE MCP Server (HTTP) — http://localhost:${port}`);
  console.log(`   Health check: http://localhost:${port}/health`);
  console.log(`   SSE endpoint: http://localhost:${port}/sse`);
});