"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCensoTools = registerCensoTools;
const zod_1 = require("zod");
const ibge_client_js_1 = require("../services/ibge-client.js");
function formatNum(v) {
    return v.toLocaleString("pt-BR");
}
function getSerie(dados) {
    const series = dados?.[0]?.resultados?.[0]?.series ?? [];
    return series.map((s) => ({
        nome: s.localidade.nome,
        id: s.localidade.id,
        valor: parseFloat(Object.values(s.serie)[0] ?? "0"),
    }));
}
function registerCensoTools(server) {
    server.registerTool("ibge_populacao_municipio", {
        title: "População de Município (Censo 2022)",
        description: `Consulta a população de um município pelo Censo Demográfico 2022.

Args:
  - municipio_id (number): Código IBGE de 7 dígitos do município

IDs de capitais: SP=3550308 | RJ=3304557 | BH=3106200 | SSA=2927408
  FOR=2304400 | REC=2611606 | MAN=1302603 | BEL=1501402 | POA=4314902
  CWB=4106902 | FLN=4205407 | GYN=5208707 | NAT=2408102 | MCZ=2704302

Use ibge_listar_municipios para obter o ID de qualquer município.`,
        inputSchema: zod_1.z.object({
            municipio_id: zod_1.z.number().int().positive().describe("Código IBGE do município (7 dígitos)"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ municipio_id }) => {
        try {
            const url = `${ibge_client_js_1.IBGE_API.v3}/agregados/9514/periodos/2022/variaveis/93?localidades=N6[${municipio_id}]`;
            const dados = await (0, ibge_client_js_1.ibgeFetch)(url);
            const serie = dados?.[0]?.resultados?.[0]?.series?.[0];
            if (!serie) {
                return { content: [{ type: "text", text: `❌ Município ID ${municipio_id} não encontrado no Censo 2022.` }] };
            }
            const pop = parseFloat(Object.values(serie.serie)[0]);
            return {
                content: [{
                        type: "text", text: `## ${serie.localidade.nome} — Censo 2022\n\n**População Total:** ${formatNum(pop)} habitantes\n\n_Fonte: IBGE Censo 2022 (Tabela 9514)_`
                    }]
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    server.registerTool("ibge_populacao_estados", {
        title: "População dos Estados (Censo 2022)",
        description: `Consulta e compara a população de todos os estados ou de um estado específico.

Args:
  - uf_id (number, opcional): ID do estado. Omita para todos.
    SP=35 | RJ=33 | MG=31 | BA=29 | RS=43 | PR=41 | PE=26 | CE=23
    PA=15 | MA=21 | GO=52 | AM=13 | ES=32 | SC=42 | PB=25 | RN=24
    AL=27 | PI=22 | MS=50 | MT=51 | DF=53 | SE=28 | RO=11 | TO=17

Retorna ranking de população com % do total nacional.`,
        inputSchema: zod_1.z.object({
            uf_id: zod_1.z.number().int().positive().optional().describe("ID do estado (ex: 35=SP). Omita para todos."),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ uf_id }) => {
        try {
            const localidade = uf_id ? `N3[${uf_id}]` : "N3[all]";
            const url = `${ibge_client_js_1.IBGE_API.v3}/agregados/9514/periodos/2022/variaveis/93?localidades=${localidade}&view=flat`;
            const dados = await (0, ibge_client_js_1.ibgeFetch)(url);
            const series = getSerie(dados);
            if (series.length === 0)
                return { content: [{ type: "text", text: "Dados não encontrados." }] };
            series.sort((a, b) => b.valor - a.valor);
            const total = series.reduce((acc, s) => acc + s.valor, 0);
            const linhas = series.map((s, i) => {
                const pct = ((s.valor / total) * 100).toFixed(2);
                return `${i + 1}. **${s.nome}**: ${formatNum(s.valor)} hab (${pct}%)`;
            });
            return {
                content: [{
                        type: "text", text: (0, ibge_client_js_1.truncateIfNeeded)(`## População por Estado — Censo 2022\n\n**Brasil:** ${formatNum(total)} habitantes\n\n` +
                            linhas.join("\n") + `\n\n_Fonte: IBGE Censo 2022 (Tabela 9514)_`)
                    }]
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    server.registerTool("ibge_densidade_demografica", {
        title: "Densidade Demográfica dos Estados",
        description: `Calcula densidade demográfica (hab/km²) combinando Censo 2022 + área territorial IBGE.

Args:
  - uf_id (number, opcional): ID do estado. Omita para ranking completo.

Retorna população, área em km² e densidade por estado, ordenados por densidade.`,
        inputSchema: zod_1.z.object({
            uf_id: zod_1.z.number().int().positive().optional().describe("ID do estado. Omita para todos."),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ uf_id }) => {
        try {
            const localidade = uf_id ? `N3[${uf_id}]` : "N3[all]";
            const [dadosPop, dadosArea] = await Promise.all([
                (0, ibge_client_js_1.ibgeFetch)(`${ibge_client_js_1.IBGE_API.v3}/agregados/9514/periodos/2022/variaveis/93?localidades=${localidade}&view=flat`),
                (0, ibge_client_js_1.ibgeFetch)(`${ibge_client_js_1.IBGE_API.v3}/agregados/9517/periodos/2022/variaveis/82?localidades=${localidade}&view=flat`).catch(() => []),
            ]);
            const pop = getSerie(dadosPop);
            const area = getSerie(dadosArea);
            const areaMap = new Map(area.map((a) => [a.id, a.valor]));
            const dados = pop.map((p) => {
                const km2 = areaMap.get(p.id) ?? 0;
                return { nome: p.nome, pop: p.valor, km2, dens: km2 > 0 ? p.valor / km2 : 0 };
            }).sort((a, b) => b.dens - a.dens);
            const linhas = dados.map((d, i) => {
                const dens = d.dens > 0 ? `${d.dens.toFixed(1)} hab/km²` : "N/D";
                const area = d.km2 > 0 ? `${formatNum(d.km2)} km²` : "N/D";
                return `${i + 1}. **${d.nome}**: ${formatNum(d.pop)} hab | ${area} | **${dens}**`;
            });
            return {
                content: [{
                        type: "text", text: (0, ibge_client_js_1.truncateIfNeeded)(`## Densidade Demográfica por Estado — Censo 2022\n\n` +
                            linhas.join("\n") + `\n\n_Fonte: IBGE Censo 2022_`)
                    }]
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
}
//# sourceMappingURL=censo.js.map