"use strict";
// tools/malha-noticias.ts — Malha geográfica e notícias do IBGE
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMalhaNoticias = registerMalhaNoticias;
const zod_1 = require("zod");
const ibge_client_js_1 = require("../services/ibge-client.js");
function registerMalhaNoticias(server) {
    // ── 1. Malha Geográfica ──────────────────────────────────────────────────
    server.registerTool("ibge_malha_geografica", {
        title: "Obter URL da Malha Geográfica",
        description: `Retorna a URL para download da malha geográfica (shapefile/GeoJSON) de estados ou municípios.

A malha geográfica é usada para: criar mapas, calcular áreas, análise espacial, visualizações.

Args:
  - tipo (string): "estado", "municipios_de_estado" ou "municipio"
  - uf (string, opcional): sigla do estado (2 letras) — para tipo "estado" ou "municipios_de_estado"
  - municipio_id (string, opcional): código IBGE do município (7 dígitos) — para tipo "municipio"
  - formato (string): "svg" (padrão), "json" (GeoJSON), "topojson"
  - resolucao (number): nível de detalhe: 1=baixo (mais rápido), 2=médio, 3=alto, 4=máximo

Retorna: URL para acesso direto à malha + instruções de uso.

Exemplos:
  - "Malha de SP" → tipo="estado", uf="SP"
  - "GeoJSON dos municípios do RJ" → tipo="municipios_de_estado", uf="RJ", formato="json"
  - "Contorno de Manaus" → tipo="municipio", municipio_id="1302603"`,
        inputSchema: zod_1.z.object({
            tipo: zod_1.z.enum(["estado", "municipios_de_estado", "municipio"])
                .describe("Tipo de malha: 'estado'=contorno do estado, 'municipios_de_estado'=municípios do estado, 'municipio'=município específico"),
            uf: zod_1.z.string().length(2).toUpperCase().optional()
                .describe("Sigla do estado (necessário para tipo 'estado' ou 'municipios_de_estado')"),
            municipio_id: zod_1.z.string().optional()
                .describe("Código IBGE do município (necessário para tipo 'municipio')"),
            formato: zod_1.z.enum(["svg", "json", "topojson"]).default("json")
                .describe("Formato de saída: 'json'=GeoJSON, 'topojson'=TopoJSON, 'svg'=SVG"),
            resolucao: zod_1.z.number().int().min(1).max(4).default(2)
                .describe("Resolução: 1=baixa, 2=média, 3=alta, 4=máxima"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ tipo, uf, municipio_id, formato, resolucao }) => {
        try {
            let url;
            let descricao;
            switch (tipo) {
                case "estado":
                    if (!uf)
                        return { content: [{ type: "text", text: "Erro: uf é obrigatório para tipo='estado'" }] };
                    url = `${ibge_client_js_1.IBGE_API.v2}/malhas/estados/${uf}?formato=${formato}&resolucao=${resolucao}`;
                    descricao = `Malha do estado ${uf}`;
                    break;
                case "municipios_de_estado":
                    if (!uf)
                        return { content: [{ type: "text", text: "Erro: uf é obrigatório para tipo='municipios_de_estado'" }] };
                    url = `${ibge_client_js_1.IBGE_API.v2}/malhas/estados/${uf}/municipios?formato=${formato}&resolucao=${resolucao}`;
                    descricao = `Malha dos municípios de ${uf}`;
                    break;
                case "municipio":
                    if (!municipio_id)
                        return { content: [{ type: "text", text: "Erro: municipio_id é obrigatório para tipo='municipio'" }] };
                    url = `${ibge_client_js_1.IBGE_API.v2}/malhas/municipios/${municipio_id}?formato=${formato}&resolucao=${resolucao}`;
                    descricao = `Malha do município ${municipio_id}`;
                    break;
                default:
                    return { content: [{ type: "text", text: "Tipo inválido" }] };
            }
            // Verificar se a URL está acessível
            const testResponse = await fetch(url, { method: "HEAD" });
            const status = testResponse.ok ? "✅ URL válida e acessível" : `⚠️ Status: ${testResponse.status}`;
            return {
                content: [{
                        type: "text",
                        text: [
                            `**Malha Geográfica IBGE — ${descricao}**`,
                            ``,
                            `📥 **URL para download:**`,
                            url,
                            ``,
                            `${status}`,
                            ``,
                            `📋 **Como usar:**`,
                            `• Copie a URL acima para baixar o arquivo ${formato.toUpperCase()}`,
                            `• Em Python: \`import requests; data = requests.get("${url}").json()\``,
                            `• Em JavaScript: \`fetch("${url}").then(r => r.json())\``,
                            `• No QGIS: Camada > Adicionar Camada > Vetor > URL acima`,
                            formato === "json"
                                ? `• O GeoJSON pode ser usado diretamente com Leaflet, Mapbox, D3.js`
                                : ``,
                        ].join("\n"),
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    // ── 2. Notícias do IBGE ──────────────────────────────────────────────────
    server.registerTool("ibge_noticias", {
        title: "Buscar Notícias do IBGE",
        description: `Busca notícias, releases e publicações recentes do IBGE.

Args:
  - quantidade (number): número de notícias a retornar (1-20, padrão: 10)
  - assunto (string, opcional): filtra por assunto/tema (ex: "censo", "pib", "desemprego")
  - produto (string, opcional): filtra por produto/pesquisa IBGE (ex: "PNAD", "IPCA", "Censo")

Retorna: Lista de notícias com título, introdução, data de publicação e link.

Exemplos:
  - "Últimas notícias do IBGE" → quantidade=10
  - "Notícias sobre o Censo 2022" → assunto="censo"
  - "Releases do IPCA" → produto="IPCA"`,
        inputSchema: zod_1.z.object({
            quantidade: zod_1.z.number().int().min(1).max(20).default(10)
                .describe("Número de notícias a retornar (1-20)"),
            assunto: zod_1.z.string().optional()
                .describe("Filtrar por assunto (ex: 'censo', 'emprego', 'agricultura')"),
            produto: zod_1.z.string().optional()
                .describe("Filtrar por produto IBGE (ex: 'PNAD', 'IPCA', 'Censo', 'PIB')"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ quantidade, assunto, produto }) => {
        try {
            let url = `${ibge_client_js_1.IBGE_API.v3}/noticias/?quantidade=${quantidade}`;
            if (assunto)
                url += `&busca=${encodeURIComponent(assunto)}`;
            if (produto)
                url += `&produto=${encodeURIComponent(produto)}`;
            const resposta = await (0, ibge_client_js_1.ibgeFetch)(url);
            const noticias = resposta.itens ?? [];
            if (noticias.length === 0) {
                return { content: [{ type: "text", text: "Nenhuma notícia encontrada com os filtros informados." }] };
            }
            const texto = noticias
                .map((n, i) => {
                const data = new Date(n.data_publicacao).toLocaleDateString("pt-BR");
                return [
                    `**${i + 1}. ${n.titulo}**`,
                    `📅 ${data} | 🏷️ ${n.produto ?? "IBGE"}`,
                    `${n.introducao?.slice(0, 200)}${(n.introducao?.length ?? 0) > 200 ? "..." : ""}`,
                    `🔗 ${n.link}`,
                ].join("\n");
            })
                .join("\n\n---\n\n");
            return {
                content: [{
                        type: "text",
                        text: (0, ibge_client_js_1.truncateIfNeeded)(`**Notícias do IBGE** (${noticias.length} de ${resposta.total} total)\n\n${texto}`),
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
}
//# sourceMappingURL=malha-noticias.js.map