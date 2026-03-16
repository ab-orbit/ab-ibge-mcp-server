#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpApp = createHttpApp;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const localidades_js_1 = require("./tools/localidades.js");
const sidra_js_1 = require("./tools/sidra.js");
const malha_noticias_js_1 = require("./tools/malha-noticias.js");
const indicadores_js_1 = require("./tools/indicadores.js");
const censo_js_1 = require("./tools/censo.js");
const cnae_js_1 = require("./tools/cnae.js");
const nomes_js_1 = require("./tools/nomes.js");
const paises_js_1 = require("./tools/paises.js");
const server = new mcp_js_1.McpServer({
    name: "ibge-mcp-server",
    version: "1.0.0",
});
(0, localidades_js_1.registerLocalidadesTools)(server);
(0, sidra_js_1.registerSidraTools)(server);
(0, malha_noticias_js_1.registerMalhaNoticias)(server);
(0, indicadores_js_1.registerIndicadoresTools)(server);
(0, censo_js_1.registerCensoTools)(server);
(0, cnae_js_1.registerCnaeTools)(server);
(0, nomes_js_1.registerNomesTools)(server);
(0, paises_js_1.registerPaisesTools)(server);
/**
 * Creates and configures the Express app for HTTP mode
 * Exported for testing purposes
 */
function createHttpApp(mcpServer) {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    // Store active SSE transports
    const transports = new Map();
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
            const transport = new sse_js_1.SSEServerTransport(`/message/${sessionId}`, res);
            // Store transport for this session
            transports.set(sessionId, transport);
            // Connect MCP server to this transport
            await mcpServer.connect(transport);
            // Cleanup when connection closes
            res.on("close", () => {
                transports.delete(sessionId);
            });
        }
        catch (error) {
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
        }
        catch (error) {
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
async function main() {
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
    }
    else {
        // Modo stdio (padrão)
        const transport = new stdio_js_1.StdioServerTransport();
        await server.connect(transport);
        console.error("✅ IBGE MCP Server (stdio) — 32 ferramentas disponíveis");
    }
}
main().catch((err) => {
    console.error("❌ Erro:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map