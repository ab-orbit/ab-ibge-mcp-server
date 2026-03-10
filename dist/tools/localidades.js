"use strict";
// tools/localidades.ts — Ferramentas para regiões, estados e municípios
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLocalidadesTools = registerLocalidadesTools;
const zod_1 = require("zod");
const ibge_client_js_1 = require("../services/ibge-client.js");
function municipioToSimples(m, uf_sigla, uf_nome) {
    return {
        id: m.id,
        nome: m.nome,
        uf_sigla: uf_sigla ?? m?.microrregiao?.mesorregiao?.UF?.sigla,
        uf_nome: uf_nome ?? m?.microrregiao?.mesorregiao?.UF?.nome,
        mesorregiao: m?.microrregiao?.mesorregiao?.nome,
        microrregiao: m?.microrregiao?.nome,
    };
}
function registerLocalidadesTools(server) {
    server.registerTool("ibge_listar_regioes", {
        title: "Listar Regiões do Brasil",
        description: `Lista as 5 grandes regiões do Brasil com seus códigos e siglas.
Retorna: id (1=Norte, 2=Nordeste, 3=Sudeste, 4=Sul, 5=Centro-Oeste), sigla, nome.`,
        inputSchema: zod_1.z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async () => {
        try {
            const regioes = await (0, ibge_client_js_1.ibgeFetch)(`${ibge_client_js_1.IBGE_API.v1}/localidades/regioes`);
            const texto = regioes.map((r) => `• [${r.id}] ${r.sigla} — ${r.nome}`).join("\n");
            return { content: [{ type: "text", text: `**Regiões do Brasil**\n\n${texto}` }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    server.registerTool("ibge_listar_estados", {
        title: "Listar Estados do Brasil",
        description: `Lista todos os 27 estados do Brasil com códigos IBGE, siglas e regiões.
Args:
  - regiao_id (opcional): 1=Norte, 2=Nordeste, 3=Sudeste, 4=Sul, 5=Centro-Oeste
Retorna: id (código IBGE), sigla, nome, região. O id é usado nas consultas do SIDRA.`,
        inputSchema: zod_1.z.object({
            regiao_id: zod_1.z.number().int().min(1).max(5).optional()
                .describe("ID da região para filtrar (1=Norte, 2=Nordeste, 3=Sudeste, 4=Sul, 5=Centro-Oeste)"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ regiao_id }) => {
        try {
            const url = regiao_id
                ? `${ibge_client_js_1.IBGE_API.v1}/localidades/regioes/${regiao_id}/estados`
                : `${ibge_client_js_1.IBGE_API.v1}/localidades/estados`;
            const estados = await (0, ibge_client_js_1.ibgeFetch)(url);
            const ordenados = [...estados].sort((a, b) => a.nome.localeCompare(b.nome));
            const texto = ordenados.map((e) => `• [${e.id}] ${e.sigla} — ${e.nome} (${e.regiao.nome})`).join("\n");
            return { content: [{ type: "text", text: `**Estados do Brasil** (${estados.length})\n\n${texto}` }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    server.registerTool("ibge_listar_municipios", {
        title: "Listar Municípios de um Estado",
        description: `Lista todos os municípios de um estado com seus códigos IBGE de 7 dígitos.
Args:
  - uf (string): sigla do estado (ex: "SP", "RJ", "MG", "BA")
  - nome_filtro (opcional): filtra por nome (case-insensitive)
Retorna: id (7 dígitos), nome, microrregião. Use o id em consultas SIDRA de municípios.`,
        inputSchema: zod_1.z.object({
            uf: zod_1.z.string().min(2).max(2).toUpperCase().describe("Sigla do estado (2 letras, ex: SP, RJ, MG)"),
            nome_filtro: zod_1.z.string().optional().describe("Texto para filtrar municípios pelo nome"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ uf, nome_filtro }) => {
        try {
            const municipios = await (0, ibge_client_js_1.ibgeFetch)(`${ibge_client_js_1.IBGE_API.v1}/localidades/estados/${uf}/municipios`);
            const uf_sigla = municipios[0]?.microrregiao?.mesorregiao?.UF?.sigla ?? uf;
            const uf_nome = municipios[0]?.microrregiao?.mesorregiao?.UF?.nome ?? uf;
            let lista = municipios.map((m) => municipioToSimples(m, uf_sigla, uf_nome));
            if (nome_filtro) {
                const f = nome_filtro.toLowerCase();
                lista = lista.filter((m) => m.nome.toLowerCase().includes(f));
            }
            lista.sort((a, b) => a.nome.localeCompare(b.nome));
            const texto = lista.map((m) => `• [${m.id}] ${m.nome}${m.microrregiao ? ` (${m.microrregiao})` : ""}`).join("\n");
            const titulo = nome_filtro ? `Municípios de ${uf_nome} com "${nome_filtro}"` : `Municípios de ${uf_nome}`;
            return { content: [{ type: "text", text: (0, ibge_client_js_1.truncateIfNeeded)(`**${titulo}** — ${lista.length} encontrados\n\n${texto}`) }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    server.registerTool("ibge_buscar_municipio", {
        title: "Buscar Município por Nome",
        description: `Busca municípios em todo o Brasil pelo nome.
Args:
  - nome (string): nome ou parte do nome (mínimo 3 caracteres)
  - uf (opcional): sigla do estado para restringir a busca
Retorna: código IBGE, nome, UF, mesorregião de todos os municípios encontrados.`,
        inputSchema: zod_1.z.object({
            nome: zod_1.z.string().min(3).describe("Nome ou parte do nome do município (mín. 3 caracteres)"),
            uf: zod_1.z.string().min(2).max(2).toUpperCase().optional().describe("Sigla do estado (ex: SP, MG)"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ nome, uf }) => {
        try {
            const url = uf
                ? `${ibge_client_js_1.IBGE_API.v1}/localidades/estados/${uf}/municipios`
                : `${ibge_client_js_1.IBGE_API.v1}/localidades/municipios`;
            const municipios = await (0, ibge_client_js_1.ibgeFetch)(url);
            const filtro = nome.toLowerCase();
            const encontrados = municipios
                .filter((m) => m.nome.toLowerCase().includes(filtro))
                .map((m) => municipioToSimples(m))
                .sort((a, b) => a.nome.localeCompare(b.nome));
            if (encontrados.length === 0) {
                return { content: [{ type: "text", text: `Nenhum município encontrado com "${nome}"${uf ? ` em ${uf}` : ""}.` }] };
            }
            const texto = encontrados
                .map((m) => `• [${m.id}] ${m.nome} — ${m.uf_sigla}/${m.uf_nome} | ${m.mesorregiao ?? ""}`)
                .join("\n");
            return { content: [{ type: "text", text: (0, ibge_client_js_1.truncateIfNeeded)(`**Municípios com "${nome}"** (${encontrados.length})\n\n${texto}`) }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
}
//# sourceMappingURL=localidades.js.map