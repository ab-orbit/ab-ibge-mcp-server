// tools/localidades.ts — Ferramentas para regiões, estados e municípios

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IBGE_API, ibgeFetch, formatToolError, truncateIfNeeded } from "../services/ibge-client.js";
import type { Regiao, Estado, Municipio, MunicipioSimples, ToolResponse } from "../types.js";

function municipioToSimples(m: Municipio, uf_sigla?: string, uf_nome?: string): MunicipioSimples {
  return {
    id: m.id,
    nome: m.nome,
    uf_sigla: uf_sigla ?? m?.microrregiao?.mesorregiao?.UF?.sigla,
    uf_nome: uf_nome ?? m?.microrregiao?.mesorregiao?.UF?.nome,
    mesorregiao: m?.microrregiao?.mesorregiao?.nome,
    microrregiao: m?.microrregiao?.nome,
  };
}

export function registerLocalidadesTools(server: McpServer): void {

  server.registerTool(
    "ibge_listar_regioes",
    {
      title: "Listar Regiões do Brasil",
      description: `Lista as 5 grandes regiões do Brasil com seus códigos e siglas.
Retorna: id (1=Norte, 2=Nordeste, 3=Sudeste, 4=Sul, 5=Centro-Oeste), sigla, nome.`,
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (): Promise<ToolResponse> => {
      try {
        const regioes = await ibgeFetch<Regiao[]>(`${IBGE_API.v1}/localidades/regioes`);
        const texto = regioes.map((r) => `• [${r.id}] ${r.sigla} — ${r.nome}`).join("\n");
        return { content: [{ type: "text", text: `**Regiões do Brasil**\n\n${texto}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );

  server.registerTool(
    "ibge_listar_estados",
    {
      title: "Listar Estados do Brasil",
      description: `Lista todos os 27 estados do Brasil com códigos IBGE, siglas e regiões.
Args:
  - regiao_id (opcional): 1=Norte, 2=Nordeste, 3=Sudeste, 4=Sul, 5=Centro-Oeste
Retorna: id (código IBGE), sigla, nome, região. O id é usado nas consultas do SIDRA.`,
      inputSchema: z.object({
        regiao_id: z.number().int().min(1).max(5).optional()
          .describe("ID da região para filtrar (1=Norte, 2=Nordeste, 3=Sudeste, 4=Sul, 5=Centro-Oeste)"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ regiao_id }): Promise<ToolResponse> => {
      try {
        const url = regiao_id
          ? `${IBGE_API.v1}/localidades/regioes/${regiao_id}/estados`
          : `${IBGE_API.v1}/localidades/estados`;
        const estados = await ibgeFetch<Estado[]>(url);
        const ordenados = [...estados].sort((a, b) => a.nome.localeCompare(b.nome));
        const texto = ordenados.map((e) => `• [${e.id}] ${e.sigla} — ${e.nome} (${e.regiao.nome})`).join("\n");
        return { content: [{ type: "text", text: `**Estados do Brasil** (${estados.length})\n\n${texto}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );

  server.registerTool(
    "ibge_listar_municipios",
    {
      title: "Listar Municípios de um Estado",
      description: `Lista todos os municípios de um estado com seus códigos IBGE de 7 dígitos.
Args:
  - uf (string): sigla do estado (ex: "SP", "RJ", "MG", "BA")
  - nome_filtro (opcional): filtra por nome (case-insensitive)
Retorna: id (7 dígitos), nome, microrregião. Use o id em consultas SIDRA de municípios.`,
      inputSchema: z.object({
        uf: z.string().min(2).max(2).toUpperCase().describe("Sigla do estado (2 letras, ex: SP, RJ, MG)"),
        nome_filtro: z.string().optional().describe("Texto para filtrar municípios pelo nome"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ uf, nome_filtro }): Promise<ToolResponse> => {
      try {
        const municipios = await ibgeFetch<Municipio[]>(`${IBGE_API.v1}/localidades/estados/${uf}/municipios`);
        const uf_sigla = municipios[0]?.microrregiao?.mesorregiao?.UF?.sigla ?? uf;
        const uf_nome = municipios[0]?.microrregiao?.mesorregiao?.UF?.nome ?? uf;
        let lista = municipios.map((m) => municipioToSimples(m, uf_sigla, uf_nome));
        if (nome_filtro) {
          // Normalizar acentos para busca flexível (São Paulo = Sao Paulo)
          const filtroNorm = nome_filtro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          lista = lista.filter((m) => {
            const nomeNorm = m.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return nomeNorm.includes(filtroNorm);
          });
        }
        lista.sort((a, b) => a.nome.localeCompare(b.nome));
        const texto = lista.map((m) => `• [${m.id}] ${m.nome}${m.microrregiao ? ` (${m.microrregiao})` : ""}`).join("\n");
        const titulo = nome_filtro ? `Municípios de ${uf_nome} com "${nome_filtro}"` : `Municípios de ${uf_nome}`;
        return { content: [{ type: "text", text: truncateIfNeeded(`**${titulo}** — ${lista.length} encontrados\n\n${texto}`) }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );

  server.registerTool(
    "ibge_buscar_municipio",
    {
      title: "Buscar Município por Nome",
      description: `Busca municípios em todo o Brasil pelo nome.
Args:
  - nome (string): nome ou parte do nome (mínimo 3 caracteres)
  - uf (opcional): sigla do estado para restringir a busca
Retorna: código IBGE, nome, UF, mesorregião de todos os municípios encontrados.`,
      inputSchema: z.object({
        nome: z.string().min(3).describe("Nome ou parte do nome do município (mín. 3 caracteres)"),
        uf: z.string().min(2).max(2).toUpperCase().optional().describe("Sigla do estado (ex: SP, MG)"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ nome, uf }): Promise<ToolResponse> => {
      try {
        const url = uf
          ? `${IBGE_API.v1}/localidades/estados/${uf}/municipios`
          : `${IBGE_API.v1}/localidades/municipios`;
        const municipios = await ibgeFetch<Municipio[]>(url);
        // Normalizar acentos para busca flexível (São Paulo = Sao Paulo)
        const filtroNorm = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const encontrados = municipios
          .filter((m) => {
            const nomeNorm = m.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return nomeNorm.includes(filtroNorm);
          })
          .map((m) => municipioToSimples(m))
          .sort((a, b) => a.nome.localeCompare(b.nome));
        if (encontrados.length === 0) {
          return { content: [{ type: "text", text: `Nenhum município encontrado com "${nome}"${uf ? ` em ${uf}` : ""}.` }] };
        }
        const texto = encontrados
          .map((m) => `• [${m.id}] ${m.nome} — ${m.uf_sigla}/${m.uf_nome} | ${m.mesorregiao ?? ""}`)
          .join("\n");
        return { content: [{ type: "text", text: truncateIfNeeded(`**Municípios com "${nome}"** (${encontrados.length})\n\n${texto}`) }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );
}
