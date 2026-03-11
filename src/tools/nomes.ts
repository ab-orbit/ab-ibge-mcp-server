// tools/nomes.ts — API de Nomes do Censo (frequência histórica e rankings)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IBGE_API, ibgeFetch, formatToolError } from "../services/ibge-client.js";
import { TTL } from "../services/cache.js";
import type { ToolResponse } from "../types.js";

interface NomeFrequencia {
  nome: string;
  sexo: string | null;
  localidade: string;
  res: Array<{
    periodo: string;
    frequencia: number;
  }>;
}

interface NomeRanking {
  nome: string;
  frequencia: number;
  ranking: number;
}

interface NomeRankingResponse {
  localidade: string;
  sexo: string | null;
  res: NomeRanking[];
}

export function registerNomesTools(server: McpServer): void {
  server.registerTool(
    "ibge_nomes_frequencia",
    {
      title: "Frequência Histórica de Nomes",
      description: `Retorna a frequência de um nome próprio no Brasil por década desde 1930.
Args:
  - nome (obrigatório): Nome próprio a pesquisar (ex: "João", "Maria")
  - localidade (opcional): Código IBGE ou "BR" para Brasil (padrão: BR)
  - sexo (opcional): "M" para masculino, "F" para feminino, null para ambos

Retorna dados do Censo com frequência por período (década).
Exemplo: "Quantas pessoas se chamam João no Brasil?"`,
      inputSchema: z.object({
        nome: z.string().min(2).describe("Nome próprio a pesquisar"),
        localidade: z.string().optional().describe("Código IBGE ou BR para Brasil"),
        sexo: z.enum(["M", "F"]).optional().describe("M=masculino, F=feminino"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args): Promise<ToolResponse> => {
      try {
        const { nome, localidade = "BR", sexo } = args;
        const nomeNormalizado = nome.trim().toLowerCase();
        const nomeCapitalizado = nomeNormalizado.charAt(0).toUpperCase() + nomeNormalizado.slice(1);

        let url = `${IBGE_API.v2}/censos/nomes/${encodeURIComponent(nomeNormalizado)}`;
        const params = new URLSearchParams();
        if (localidade && localidade !== "BR") {
          params.append("localidade", localidade);
        }
        if (sexo) {
          params.append("sexo", sexo);
        }
        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        const dados = await ibgeFetch<NomeFrequencia[]>(url, TTL.NOMES);

        if (!dados || dados.length === 0) {
          return {
            content: [{
              type: "text",
              text: `Nome "${nomeCapitalizado}" não encontrado nos dados do Censo.\n\nVerifique:\n- Grafia correta\n- Nomes compostos devem ser consultados separadamente\n- A base contém nomes registrados no Brasil desde 1930`
            }]
          };
        }

        let totalPessoas = 0;
        const periodos: string[] = [];

        for (const registro of dados) {
          for (const item of registro.res) {
            totalPessoas += item.frequencia;
            const inicio = item.periodo.substring(0, 4);
            const fim = item.periodo.substring(5, 9);
            periodos.push(`  • ${inicio}-${fim}: ${item.frequencia.toLocaleString("pt-BR")} pessoas`);
          }
        }

        const sexoText = sexo === "M" ? " (masculino)" : sexo === "F" ? " (feminino)" : "";
        const localidadeText = localidade === "BR" ? "Brasil" : `localidade ${localidade}`;

        const resultado = `**Nome: ${nomeCapitalizado}${sexoText}**
**Total**: ${totalPessoas.toLocaleString("pt-BR")} pessoas registradas (${localidadeText})

**Frequência por década**:
${periodos.join("\n")}

_Fonte: Censo Demográfico IBGE_`;

        return { content: [{ type: "text", text: resultado }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );

  server.registerTool(
    "ibge_nomes_ranking",
    {
      title: "Ranking de Nomes Mais Populares",
      description: `Retorna os nomes mais populares do Brasil ou de uma localidade específica.
Args:
  - localidade (opcional): Código IBGE de estado/município ou "BR" para Brasil (padrão: BR)
  - sexo (opcional): "M" para masculino, "F" para feminino, null para ambos
  - decada (opcional): Década específica (ex: 1990, 2000, 2010)

Retorna ranking com nome, frequência e posição.
Exemplo: "Quais os nomes mais comuns no Brasil?"`,
      inputSchema: z.object({
        localidade: z.string().optional().describe("Código IBGE ou BR"),
        sexo: z.enum(["M", "F"]).optional().describe("M=masculino, F=feminino"),
        decada: z.number().int().min(1930).max(2010).multipleOf(10).optional()
          .describe("Década (1930, 1940, ..., 2010)"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args): Promise<ToolResponse> => {
      try {
        const { localidade = "BR", sexo, decada } = args;

        let url = `${IBGE_API.v2}/censos/nomes/ranking`;
        const params = new URLSearchParams();
        if (localidade && localidade !== "BR") {
          params.append("localidade", localidade);
        }
        if (sexo) {
          params.append("sexo", sexo);
        }
        if (decada) {
          params.append("decada", decada.toString());
        }
        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        const response = await ibgeFetch<NomeRankingResponse[]>(url, TTL.NOMES);

        if (!response || response.length === 0 || !response[0].res || response[0].res.length === 0) {
          return {
            content: [{
              type: "text",
              text: "Nenhum dado de ranking encontrado para os parâmetros especificados."
            }]
          };
        }

        const ranking = response[0].res;
        const top20 = ranking.slice(0, 20);
        const lista = top20.map((item, idx) => {
          const pos = (idx + 1).toString().padStart(2, " ");
          const freq = item.frequencia !== undefined && item.frequencia !== null
            ? item.frequencia.toLocaleString("pt-BR")
            : "N/D";
          return `  ${pos}. ${item.nome} — ${freq} pessoas`;
        }).join("\n");

        const sexoText = sexo === "M" ? " masculinos" : sexo === "F" ? " femininos" : "";
        const localidadeText = localidade === "BR" ? "Brasil" : `localidade ${localidade}`;
        const decadaText = decada ? ` (década de ${decada})` : "";

        const resultado = `**Ranking de nomes${sexoText} mais populares**
**Localidade**: ${localidadeText}${decadaText}

**Top 20**:
${lista}

${ranking.length > 20 ? `_Mostrando 20 de ${ranking.length} nomes disponíveis_\n` : ""}_Fonte: Censo Demográfico IBGE_`;

        return { content: [{ type: "text", text: resultado }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );
}