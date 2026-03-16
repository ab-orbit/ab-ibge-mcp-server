#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";
import { registerLocalidadesTools } from "./tools/localidades.js";
import { registerSidraTools } from "./tools/sidra.js";
import { registerMalhaNoticias } from "./tools/malha-noticias.js";
import { registerIndicadoresTools } from "./tools/indicadores.js";
import { registerCensoTools } from "./tools/censo.js";
import { registerCnaeTools } from "./tools/cnae.js";
import { registerNomesTools } from "./tools/nomes.js";
import { registerPaisesTools } from "./tools/paises.js";

const server = new McpServer({
  name: "ibge-mcp-server",
  version: "1.0.0",
});

registerLocalidadesTools(server);
registerSidraTools(server);
registerMalhaNoticias(server);
registerIndicadoresTools(server);
registerCensoTools(server);
registerCnaeTools(server);
registerNomesTools(server);
registerPaisesTools(server);

/**
 * Creates and configures the Express app for HTTP mode
 * Exported for testing purposes
 */
export function createHttpApp(mcpServer: McpServer): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Store active SSE transports
  const transports = new Map<string, SSEServerTransport>();

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      name: "ibge-mcp-server",
      version: "2.2.0",
      tools: 32,
      mode: "http"
    });
  });

  // SSE endpoint for MCP communication (GET for EventSource)
  app.get("/sse", async (req, res) => {
    try {
      // Create unique session ID
      const sessionId = Math.random().toString(36).substring(7);

      // Create SSE transport with session-specific message endpoint
      const transport = new SSEServerTransport(`/message/${sessionId}`, res);

      // Store transport for this session
      transports.set(sessionId, transport);

      // Connect MCP server to this transport
      await mcpServer.connect(transport);

      // Cleanup when connection closes
      res.on("close", () => {
        transports.delete(sessionId);
      });

    } catch (error) {
      // SSE connection errors are expected when client disconnects
      // or when testing without proper MCP client
      if (!res.headersSent) {
        res.status(500).json({
          error: "SSE connection failed",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  });

  // POST /message/:sessionId - Receives MCP messages from client
  app.post("/message/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const transport = transports.get(sessionId);

    if (!transport) {
      return res.status(404).json({
        error: "Session not found",
        message: `No active SSE session with ID: ${sessionId}`
      });
    }

    try {
      // Let the transport handle the POST message
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          error: "Message handling failed",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  });

  return app;
}

async function main(): Promise<void> {
  const mode = process.env.MCP_TRANSPORT || "stdio";

  if (mode === "http") {
    // Modo HTTP/SSE
    const app = createHttpApp(server);
    const port = parseInt(process.env.PORT || "3000");

    app.listen(port, () => {
      console.error(`✅ IBGE MCP Server (HTTP) — http://localhost:${port}`);
      console.error(`   Health check: http://localhost:${port}/health`);
      console.error(`   SSE endpoint: http://localhost:${port}/sse`);
    });
  } else {
    // Modo stdio (padrão)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("✅ IBGE MCP Server (stdio) — 32 ferramentas disponíveis");
  }
}

main().catch((err: unknown) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
