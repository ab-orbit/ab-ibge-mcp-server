#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const localidades_js_1 = require("./tools/localidades.js");
const sidra_js_1 = require("./tools/sidra.js");
const malha_noticias_js_1 = require("./tools/malha-noticias.js");
const indicadores_js_1 = require("./tools/indicadores.js");
const censo_js_1 = require("./tools/censo.js");
const cnae_js_1 = require("./tools/cnae.js");
const nomes_js_1 = require("./tools/nomes.js");
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
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("✅ IBGE MCP Server iniciado — 27+ ferramentas disponíveis");
}
main().catch((err) => {
    console.error("❌ Erro:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map