#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ IBGE MCP Server iniciado — 30+ ferramentas disponíveis");
}

main().catch((err: unknown) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
