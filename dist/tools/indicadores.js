"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIndicadoresTools = registerIndicadoresTools;
const zod_1 = require("zod");
const ibge_client_js_1 = require("../services/ibge-client.js");
const INDICADORES = {
    IPCA: { tabela: "1419", variavel: "63", nome: "IPCA - Variação Mensal", unidade: "%" },
    IPCA_ACUMULADO: { tabela: "1419", variavel: "2266", nome: "IPCA - Acumulado 12 meses", unidade: "%" },
    DESEMPREGO: { tabela: "6381", variavel: "4099", nome: "PNAD - Taxa de Desocupação", unidade: "%" },
    RENDIMENTO: { tabela: "6403", variavel: "5929", nome: "PNAD - Rendimento Médio per capita", unidade: "R$" },
    INPC: { tabela: "1736", variavel: "44", nome: "INPC - Variação Mensal", unidade: "%" },
};
function registerIndicadoresTools(server) {
    server.registerTool("ibge_indicador_economico", {
        title: "Consultar Indicador Econômico",
        description: `Busca indicadores econômicos e sociais com série histórica.

Args:
  - indicador: "IPCA" | "IPCA_ACUMULADO" | "DESEMPREGO" | "RENDIMENTO" | "INPC"
  - periodos: "ultimo" ou "last" (mais recente), "ultimos6" (últimos 6), "ultimos12", "202401-202412" (intervalo)

Exemplos:
  - Inflação 2024 → indicador:"IPCA", periodos:"202401-202412"
  - Desemprego atual → indicador:"DESEMPREGO", periodos:"ultimo"`,
        inputSchema: zod_1.z.object({
            indicador: zod_1.z.enum(["IPCA", "IPCA_ACUMULADO", "DESEMPREGO", "RENDIMENTO", "INPC"]),
            periodos: zod_1.z.string().default("ultimos12"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ indicador, periodos }) => {
        try {
            const cfg = INDICADORES[indicador];
            // Traduzir aliases pt-br para formato SIDRA: ultimo→last, ultimos6→last%206, etc.
            const periodoSidra = periodos
                .replace(/^ultimo$/i, "last")
                .replace(/^ultimos?\s*(\d+)$/i, (_, n) => `last%20${n}`)
                .replace(/^last\[(\d+)\]$/i, (_, n) => `last%20${n}`);
            const url = `${ibge_client_js_1.IBGE_API.v3}/agregados/${cfg.tabela}/periodos/${periodoSidra}/variaveis/${cfg.variavel}?localidades=N1[all]&view=flat`;
            const dados = await (0, ibge_client_js_1.ibgeFetch)(url);
            const serie = dados?.[0]?.resultados?.[0]?.series?.[0];
            if (!serie)
                return { content: [{ type: "text", text: `Dados não encontrados para ${indicador} no período "${periodos}".` }] };
            const entradas = Object.entries(serie.serie);
            const ultimo = entradas.at(-1);
            const linhas = entradas.map(([p, v]) => `  - ${p}: **${v} ${cfg.unidade}**`);
            return {
                content: [{
                        type: "text", text: (0, ibge_client_js_1.truncateIfNeeded)(`## ${cfg.nome}\n\n` +
                            (ultimo ? `**Mais recente (${ultimo[0]}):** ${ultimo[1]} ${cfg.unidade}\n\n` : "") +
                            `### Série Histórica\n${linhas.join("\n")}\n\n_Fonte: IBGE SIDRA Tabela ${cfg.tabela}_`)
                    }]
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    server.registerTool("ibge_listar_indicadores", {
        title: "Listar Indicadores Disponíveis",
        description: "Lista os indicadores econômicos disponíveis neste servidor MCP com seus IDs para uso em ibge_indicador_economico.",
        inputSchema: zod_1.z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async () => {
        const linhas = Object.entries(INDICADORES).map(([chave, info]) => `- **${chave}**: ${info.nome} (${info.unidade})`);
        return {
            content: [{
                    type: "text", text: `## Indicadores Econômicos Disponíveis\n\n${linhas.join("\n")}\n\nUse com: \`ibge_indicador_economico\``
                }]
        };
    });
}
//# sourceMappingURL=indicadores.js.map