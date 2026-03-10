// tools/indicadores.ts — Indicadores econômicos do IBGE
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IBGE_API, ibgeFetch, formatToolError, truncateIfNeeded } from "../services/ibge-client.js";
import type { SidraResultado } from "../types.js";

const INDICADORES: Record<string, { tabela: string; variavel: string; nome: string; unidade: string }> = {
  IPCA: { tabela: "1737", variavel: "63", nome: "IPCA - Variação Mensal", unidade: "%" },
  IPCA_ACUMULADO: { tabela: "1737", variavel: "69", nome: "IPCA - Acumulado 12 meses", unidade: "%" },
  DESEMPREGO: { tabela: "6381", variavel: "4099", nome: "PNAD - Taxa de Desocupação", unidade: "%" },
  RENDIMENTO: { tabela: "6403", variavel: "5929", nome: "PNAD - Rendimento Médio per capita", unidade: "R$" },
  INPC: { tabela: "1736", variavel: "44", nome: "INPC - Variação Mensal", unidade: "%" },
};

export function registerIndicadoresTools(server: McpServer): void {

  server.registerTool(
    "ibge_indicador_economico",
    {
      title: "Consultar Indicador Econômico",
      description: `Busca indicadores econômicos e sociais com série histórica.

Args:
  - indicador: "IPCA" | "IPCA_ACUMULADO" | "DESEMPREGO" | "RENDIMENTO" | "INPC"
  - periodos: "ultimo" ou "last" (mais recente), "ultimos6" (últimos 6), "ultimos12", "202401-202412" (intervalo)

Exemplos:
  - Inflação 2024 → indicador:"IPCA", periodos:"202401-202412"
  - Desemprego atual → indicador:"DESEMPREGO", periodos:"ultimo"`,
      inputSchema: z.object({
        indicador: z.enum(["IPCA", "IPCA_ACUMULADO", "DESEMPREGO", "RENDIMENTO", "INPC"]),
        periodos: z.string().default("ultimos12"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ indicador, periodos }) => {
      try {
        const cfg = INDICADORES[indicador];
        // Traduzir aliases pt-br para formato SIDRA: ultimo→last, ultimos6→last%206, etc.
        const periodoSidra = periodos
          .replace(/^ultimo$/i, "last")
          .replace(/^ultimos?\s*(\d+)$/i, (_, n) => `last%20${n}`)
          .replace(/^last\[(\d+)\]$/i, (_, n) => `last%20${n}`);
        const url = `${IBGE_API.v3}/agregados/${cfg.tabela}/periodos/${periodoSidra}/variaveis/${cfg.variavel}?localidades=N1[all]&view=flat`;
        const dados = await ibgeFetch<SidraResultado[]>(url);
        const serie = dados?.[0]?.resultados?.[0]?.series?.[0];
        if (!serie) return { content: [{ type: "text", text: `Dados não encontrados para ${indicador} no período "${periodos}".` }] };

        const entradas = Object.entries(serie.serie);
        const ultimo = entradas.at(-1);
        const linhas = entradas.map(([p, v]) => `  - ${p}: **${v} ${cfg.unidade}**`);

        return {
          content: [{
            type: "text", text: truncateIfNeeded(
              `## ${cfg.nome}\n\n` +
              (ultimo ? `**Mais recente (${ultimo[0]}):** ${ultimo[1]} ${cfg.unidade}\n\n` : "") +
              `### Série Histórica\n${linhas.join("\n")}\n\n_Fonte: IBGE SIDRA Tabela ${cfg.tabela}_`
            )
          }]
        };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );

  server.registerTool(
    "ibge_listar_indicadores",
    {
      title: "Listar Indicadores Disponíveis",
      description: "Lista os indicadores econômicos disponíveis neste servidor MCP com seus IDs para uso em ibge_indicador_economico.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const linhas = Object.entries(INDICADORES).map(
        ([chave, info]) => `- **${chave}**: ${info.nome} (${info.unidade})`
      );
      return {
        content: [{
          type: "text", text:
            `## Indicadores Econômicos Disponíveis\n\n${linhas.join("\n")}\n\nUse com: \`ibge_indicador_economico\``
        }]
      };
    }
  );
}
