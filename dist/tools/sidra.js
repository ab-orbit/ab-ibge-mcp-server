"use strict";
// tools/sidra.ts — Ferramentas para o SIDRA (Sistema IBGE de Recuperação Automática)
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSidraTools = registerSidraTools;
const zod_1 = require("zod");
const ibge_client_js_1 = require("../services/ibge-client.js");
const cache_js_1 = require("../services/cache.js");
const LOCALIDADES_COMUNS = {
    BR: "N1[all]",
    REGIOES: "N2[all]",
    ESTADOS: "N3[all]",
    MUNICIPIOS: "N6[all]",
};
// Catálogo de tabelas por tema — para busca por palavras-chave em português
const CATALOGO_TEMAS = [
    {
        temas: ["escolaridade", "educação", "instrução", "alfabetização", "letramento", "ensino", "estudo"],
        tabelas: [
            { id: "9543", nome: "Taxa de alfabetização — Censo 2022 (15 anos ou mais)", variavel: "2513" },
            { id: "9547", nome: "Nível de instrução — Censo 2022", variavel: "2512" },
            { id: "9516", nome: "Rendimento e escolaridade — Indicadores ODS", variavel: "2513" },
        ],
    },
    {
        temas: ["população", "habitantes", "censo", "pessoas", "moradores"],
        tabelas: [
            { id: "9514", nome: "População residente — Censo 2022", variavel: "93" },
            { id: "9515", nome: "População por sexo e idade — Censo 2022" },
            { id: "9524", nome: "Domicílios e moradores — Censo 2022" },
        ],
    },
    {
        temas: ["pib", "produto interno bruto", "riqueza", "economia municipal"],
        tabelas: [
            { id: "5938", nome: "PIB dos Municípios", variavel: "37" },
            { id: "5939", nome: "PIB per capita dos Municípios", variavel: "497" },
        ],
    },
    {
        temas: ["ipca", "inflação", "preço", "inpc", "custo de vida"],
        tabelas: [
            { id: "1419", nome: "IPCA — Variação mensal", variavel: "63" },
            { id: "1736", nome: "INPC — Variação mensal", variavel: "44" },
        ],
    },
    {
        temas: ["desemprego", "desocupação", "emprego", "trabalho", "ocupação"],
        tabelas: [
            { id: "6381", nome: "PNAD — Taxa de desocupação", variavel: "4099" },
            { id: "6403", nome: "PNAD — Rendimento médio mensal", variavel: "5929" },
        ],
    },
    {
        temas: ["densidade", "área", "território", "extensão territorial"],
        tabelas: [
            { id: "9517", nome: "Área territorial — Censo 2022", variavel: "82" },
        ],
    },
    {
        temas: ["renda", "rendimento", "salário", "pobreza", "desigualdade"],
        tabelas: [
            { id: "6403", nome: "PNAD — Rendimento médio domiciliar per capita", variavel: "5929" },
            { id: "9543", nome: "Rendimento e alfabetização por cor/raça — Censo 2022" },
        ],
    },
    {
        temas: ["saneamento", "água", "esgoto", "lixo", "coleta"],
        tabelas: [
            { id: "9529", nome: "Domicílios por tipo de esgotamento sanitário — Censo 2022" },
            { id: "9528", nome: "Domicílios com abastecimento de água — Censo 2022" },
        ],
    },
    {
        temas: ["mortalidade", "saúde", "expectativa", "longevidade"],
        tabelas: [
            { id: "9542", nome: "Mortalidade infantil — Censo 2022" },
        ],
    },
];
function formatarSerie(serie) {
    return Object.entries(serie).map(([p, v]) => `  ${p}: ${v}`).join("\n");
}
function formatarResultadoSidra(dados) {
    const linhas = [];
    for (const variavel of dados) {
        linhas.push(`\n📊 **${variavel.variavel}** (${variavel.unidade})`);
        for (const resultado of variavel.resultados) {
            for (const serie of resultado.series) {
                linhas.push(`\n  📍 ${serie.localidade.nome} (${serie.localidade.nivel.nome})`);
                linhas.push(formatarSerie(serie.serie));
            }
        }
    }
    return linhas.join("\n");
}
function resolverLocalidade(localidade) {
    if (LOCALIDADES_COMUNS[localidade])
        return LOCALIDADES_COMUNS[localidade];
    if (/^\d{2}$/.test(localidade))
        return `N3[${localidade}]`;
    if (/^\d{7}$/.test(localidade))
        return `N6[${localidade}]`;
    return "N1[all]";
}
function registerSidraTools(server) {
    server.registerTool("ibge_sidra_pesquisar_tabelas", {
        title: "Pesquisar Tabelas do SIDRA",
        description: `Pesquisa tabelas (agregados) disponíveis no SIDRA por palavra-chave ou pesquisa.
Args:
  - pesquisa_id (opcional): CN=Censo, CA=Censo Agro, EC=PIB Municipal, IN=Indicadores, PD=PNAD, PA=Prod.Agrícola
  - nome_filtro (opcional): texto para filtrar tabelas pelo nome (ex: "população", "PIB", "IPCA")
Retorna: id, nome, período e variáveis das tabelas encontradas (máx. 50).`,
        inputSchema: zod_1.z.object({
            pesquisa_id: zod_1.z.string().optional().describe("Código da pesquisa IBGE (ex: CN, CA, EC, IN, PD, PA)"),
            nome_filtro: zod_1.z.string().optional().describe("Texto para filtrar tabelas pelo nome"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ pesquisa_id, nome_filtro }) => {
        try {
            // 1. Busca no catálogo semântico (muito mais eficaz para português)
            if (nome_filtro && !pesquisa_id) {
                const termo = nome_filtro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const matches = CATALOGO_TEMAS.filter((entrada) => entrada.temas.some((t) => {
                    const tNorm = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return tNorm.includes(termo) || termo.includes(tNorm);
                }));
                if (matches.length > 0) {
                    const linhas = matches.flatMap((m) => m.tabelas.map((t) => `• **Tabela ${t.id}** — ${t.nome}${t.variavel ? `\n  Variável principal: ${t.variavel}` : ""}`));
                    return {
                        content: [{
                                type: "text", text: `**Tabelas IBGE para "${nome_filtro}"**\n\n${linhas.join("\n\n")}\n\n` +
                                    `💡 Use ibge_sidra_metadados_tabela para ver detalhes ou ibge_sidra_consultar_tabela para os dados.\n` +
                                    `Para dados por município: localidade="MUNICIPIOS" ou estado_id="XX"`
                            }]
                    };
                }
            }
            const url = pesquisa_id
                ? `${ibge_client_js_1.IBGE_API.v3}/agregados?pesquisa=${pesquisa_id}`
                : `${ibge_client_js_1.IBGE_API.v3}/agregados`;
            const grupos = await (0, ibge_client_js_1.ibgeFetch)(url);
            // Aplanar grupos → tabelas reais, preservando pesquisaID/Nome
            let lista = grupos.flatMap((g) => (g.agregados ?? []).map((a) => ({
                ...a,
                pesquisaID: a.pesquisaID || g.id,
                pesquisaNome: a.pesquisaNome || g.nome
            })));
            if (nome_filtro) {
                const f = nome_filtro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                lista = lista.filter((a) => {
                    const n = a.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return f.split(" ").some((palavra) => n.includes(palavra));
                });
            }
            if (lista.length === 0) {
                const temas = CATALOGO_TEMAS.map((e) => e.temas[0]).join(", ");
                const msg = pesquisa_id
                    ? `Nenhuma tabela encontrada para pesquisa "${pesquisa_id}". Pesquisas válidas: CN=Censo, CA=Censo Agro, EC=PIB Municipal, IN=Indicadores ODS, PD=PNAD Dom., PA=Prod.Agrícola, PM=PNAD Mensal, AQ=Pesq.Aquicultura`
                    : `Nenhuma tabela encontrada para "${nome_filtro}".\n\nTemas no catálogo: ${temas}`;
                return { content: [{ type: "text", text: msg }] };
            }
            const limitada = lista.slice(0, 50);
            const texto = limitada.map((a) => {
                const periodo = a.periodicidade
                    ? `${a.periodicidade.inicio}–${a.periodicidade.fim} (${a.periodicidade.frequencia})`
                    : "N/A";
                const vars = (a.variaveis ?? []).slice(0, 3).map((v) => v.nome).join(", ");
                return `• **Tabela ${a.id}** [${a.pesquisaID}] — ${a.nome}\n  Período: ${periodo} | Variáveis: ${vars}${(a.variaveis?.length ?? 0) > 3 ? "..." : ""}`;
            }).join("\n\n");
            const aviso = lista.length > 50 ? `\n\n⚠️ Mostrando 50 de ${lista.length} tabelas. Use nome_filtro para refinar.` : "";
            return {
                content: [{
                        type: "text",
                        text: (0, ibge_client_js_1.truncateIfNeeded)(`**Tabelas SIDRA: ${lista.length} encontradas** (pesquisa: ${pesquisa_id ?? "todas"})\n\n${texto}${aviso}`)
                    }]
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    server.registerTool("ibge_sidra_metadados_tabela", {
        title: "Ver Metadados de Tabela SIDRA",
        description: `Retorna metadados completos de uma tabela SIDRA: variáveis, classificações com IDs de categorias, níveis territoriais e períodos disponíveis.
Use SEMPRE antes de ibge_sidra_consultar_tabela quando não souber os IDs de variável ou classificação.
Retorna também os valores exatos para o parâmetro "classificacao" prontos para uso.
Args:
  - tabela_id (string): código da tabela (ex: "9514", "1419", "5938", "9543")`,
        inputSchema: zod_1.z.object({
            tabela_id: zod_1.z.string().describe("Código da tabela SIDRA"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ tabela_id }) => {
        try {
            const dados = await (0, ibge_client_js_1.ibgeFetch)(`${ibge_client_js_1.IBGE_API.v3}/agregados/${tabela_id}/metadados`);
            const variaveis = (dados.variaveis ?? []).map((v) => `  • [${v.id}] ${v.nome} (${v.unidade})`).join("\n");
            const niveis = [...(dados.nivelTerritorial?.Administrativo ?? []), ...(dados.nivelTerritorial?.Especial ?? [])].join(", ");
            // Montar bloco de classificações com todas as categorias + strings prontas para uso
            const classificacoes = (dados.classificacoes ?? []).map((c) => {
                const totalCats = c.sumarizacao?.length > 0
                    ? c.sumarizacao.map((id) => {
                        const cat = (c.categorias ?? []).find((ct) => ct.id === id);
                        return `${id}${cat ? `(${cat.nome})` : ""}`;
                    }).join(",")
                    : "all";
                const todasCats = (c.categorias ?? []).map((cat) => `    ${cat.id} = ${cat.nome}`).join("\n");
                return [
                    `  • [${c.id}] ${c.nome}`,
                    `    → Para totais/agregados: classificacao="${c.id}[${totalCats}]"`,
                    `    → Para todas as categorias: classificacao="${c.id}[all]"`,
                    `    Categorias disponíveis:`,
                    todasCats,
                ].join("\n");
            }).join("\n\n");
            // Gerar string de classificacao pronta para uso (todos os totais combinados)
            const classificacaoTotal = (dados.classificacoes ?? [])
                .map((c) => `${c.id}[${c.sumarizacao?.length > 0 ? c.sumarizacao.join(",") : "all"}]`)
                .join("|");
            return {
                content: [{
                        type: "text",
                        text: [
                            `**Metadados — Tabela SIDRA ${tabela_id}**`,
                            `📌 ${dados.nome}`,
                            `🔬 Pesquisa: ${dados.pesquisaNome} (${dados.pesquisaID})`,
                            `📅 Período: ${dados.periodicidade?.inicio} a ${dados.periodicidade?.fim} (${dados.periodicidade?.frequencia})`,
                            `🗺️ Níveis territoriais: ${niveis}`,
                            `\n📊 **Variáveis:**\n${variaveis}`,
                            ...(classificacaoTotal ? [
                                `\n💡 **classificacao para totais (copie e use):**`,
                                `   ${classificacaoTotal}`,
                            ] : []),
                            `\n🗂️ **Classificações (IDs e categorias):**\n${classificacoes || "  Nenhuma — não é necessário o parâmetro classificacao"}`,
                        ].join("\n"),
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    server.registerTool("ibge_periodos_tabela", {
        title: "Consultar Períodos Disponíveis de uma Tabela SIDRA",
        description: `Retorna todos os períodos disponíveis para uma tabela SIDRA.
Use ANTES de ibge_sidra_consultar_tabela quando precisar saber quais anos/meses existem.
Evita erros de "período não encontrado" e HTTP 500 por período inválido.
Args:
  - tabela_id: código da tabela (ex: "1419" para IPCA, "9514" para Censo)
Retorna: lista de períodos no formato AAAA, AAAAMM ou trimestre.`,
        inputSchema: zod_1.z.object({
            tabela_id: zod_1.z.string().describe("Código da tabela SIDRA (ex: '1419', '9514', '6381')"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ tabela_id }) => {
        try {
            const periodos = await (0, ibge_client_js_1.ibgeFetch)(`${ibge_client_js_1.IBGE_API.v3}/agregados/${tabela_id}/periodos`);
            if (!periodos?.length) {
                return { content: [{ type: "text", text: `Nenhum período encontrado para tabela ${tabela_id}.` }] };
            }
            const ids = periodos.map((p) => p.id);
            const mais_recente = ids[ids.length - 1];
            const mais_antigo = ids[0];
            const total = ids.length;
            // Mostrar últimos 24 e primeiros 3 para não sobrecarregar
            const amostra = total > 27
                ? [...ids.slice(0, 3), "...", ...ids.slice(-24)]
                : ids;
            return {
                content: [{
                        type: "text",
                        text: [
                            `**Períodos disponíveis — Tabela SIDRA ${tabela_id}**`,
                            `📅 Total: ${total} períodos | Mais antigo: ${mais_antigo} | Mais recente: ${mais_recente}`,
                            ``,
                            `Períodos (${amostra.length < total ? "amostra" : "todos"}):`,
                            amostra.join(", "),
                            ``,
                            `💡 Use em ibge_sidra_consultar_tabela:`,
                            `   periodo="${mais_recente}"  → dado mais recente`,
                            `   periodo="-6"              → últimos 6 períodos`,
                            `   periodo="-12"             → últimos 12 períodos`,
                            `   periodo="${mais_antigo}-${mais_recente}" → série completa (pode ser lento)`,
                        ].join("\n"),
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    server.registerTool("ibge_sidra_consultar_tabela", {
        title: "Consultar Dados de Tabela do SIDRA",
        description: `Consulta dados de uma tabela específica do SIDRA com séries históricas por localidade.

FLUXO RECOMENDADO para tabelas desconhecidas:
  1. ibge_sidra_metadados_tabela → descobre variáveis, classificações e períodos válidos
  2. ibge_periodos_tabela → confirma quais períodos existem (evita HTTP 500)
  3. ibge_sidra_consultar_tabela → consulta com parâmetros corretos

Args:
  - tabela_id: código da tabela
  - variaveis (opcional): ID(s) da(s) variável(is) separados por pipe "|" (ex: "93|94|95"). Sem valor = todas.
  - localidade: "BR", "ESTADOS", "REGIOES", 2 dígitos=estado (ex:"35"), 7 dígitos=município
  - periodo: "last"=mais recente, "-6"=últimos 6, "-12"=últimos 12, "AAAA"=ano específico
    Use ibge_periodos_tabela para ver períodos válidos e evitar HTTP 500.
  - classificacao (opcional): cópie o valor pronto de ibge_sidra_metadados_tabela.
    Formato: "ID[cats]|ID[cats]" — use "ID[all]" para todas as categorias de uma classificação.
    NUNCA invente IDs de categoria — sempre consulte metadados primeiro.

Tabelas populares: 9514=Censo2022 pop, 9543=Censo2022 alfabetização, 5938=PIB Municipal, 1419=IPCA, 6381=PNAD Desocupação`,
        inputSchema: zod_1.z.object({
            tabela_id: zod_1.z.string().describe("Código da tabela SIDRA"),
            variaveis: zod_1.z.string().optional().describe("Código(s) da(s) variável(is) separados por pipe '|' (ex: '93|94|95')"),
            localidade: zod_1.z.string().default("BR").describe("BR, ESTADOS, REGIOES, código de estado (2 dígitos) ou município (7 dígitos)"),
            periodo: zod_1.z.string().default("last").describe("last, last[N], AAAA, AAAAMM"),
            classificacao: zod_1.z.string().optional().describe("Filtro de classificação no formato 'ID[cats]'"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ tabela_id, variaveis, localidade, periodo, classificacao }) => {
        try {
            const codigoLocalidade = resolverLocalidade(localidade);
            const variavelStr = variaveis ?? "allxp";
            // Normalizar formato do período:
            //   last[N] → last N (SIDRA usa espaço não colchetes)
            //   -N      → last N (shorthand da API: -6 = últimos 6)
            //   ultimo/ultimos → last / last N
            const periodoNorm = periodo
                .replace(/^ultimo$/i, "last")
                .replace(/^ultimos?\s*(\d+)$/i, (_, n) => `last%20${n}`)
                .replace(/^last\[(\d+)\]$/i, (_, n) => `last%20${n}`)
                .replace(/^-(\d+)$/, (_, n) => `last%20${n}`);
            let url = `${ibge_client_js_1.IBGE_API.v3}/agregados/${tabela_id}/periodos/${periodoNorm}/variaveis/${variavelStr}?localidades=${codigoLocalidade}`;
            if (classificacao)
                url += `&classificacao=${classificacao}`;
            const dados = await (0, ibge_client_js_1.ibgeFetch)(url, cache_js_1.TTL.SIDRA_DATA);
            if (!dados?.length)
                return { content: [{ type: "text", text: `Nenhum dado encontrado para a tabela ${tabela_id}.` }] };
            const resultado = formatarResultadoSidra(dados);
            return { content: [{ type: "text", text: (0, ibge_client_js_1.truncateIfNeeded)(`**SIDRA Tabela ${tabela_id}** | ${localidade} | ${periodo}\n${resultado}`) }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    server.registerTool("ibge_ipca", {
        title: "Consultar IPCA (Inflação)",
        description: `Consulta o IPCA — principal indicador de inflação do Brasil.
Args:
  - ultimos_meses: número de meses a retornar (1-60, padrão: 12)
    IMPORTANTE: para tipos "acumulada_ano" ou "acumulada_12_meses", retorna apenas os N períodos mais recentes
  - tipo: "variacao_mensal" (padrão), "variacao_acumulada_ano", "variacao_acumulada_12_meses"
Retorna: série histórica com variação percentual por mês.`,
        inputSchema: zod_1.z.object({
            ultimos_meses: zod_1.z.number().int().min(1).max(60).default(12).describe("Número de meses (1-60)"),
            tipo: zod_1.z.enum(["variacao_mensal", "variacao_acumulada_ano", "variacao_acumulada_12_meses"])
                .default("variacao_mensal").describe("Tipo de variação"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ ultimos_meses, tipo }) => {
        try {
            const varMap = { variacao_mensal: "63", variacao_acumulada_ano: "69", variacao_acumulada_12_meses: "2265" };
            // Para variações acumuladas, cada ponto já é um acumulado, então usamos "last N" normalmente
            const periodo = `last%20${ultimos_meses}`;
            // IMPORTANTE: Tabela 1737 tem série histórica completa desde 1979 até presente
            // Tabela 1419 antiga só tinha dados até 2019
            const url = `${ibge_client_js_1.IBGE_API.v3}/agregados/1737/periodos/${periodo}/variaveis/${varMap[tipo]}?localidades=N1[all]`;
            const dados = await (0, ibge_client_js_1.ibgeFetch)(url);
            return { content: [{ type: "text", text: `**IPCA — ${tipo.replace(/_/g, " ")}** (últimos ${ultimos_meses} meses)\n${formatarResultadoSidra(dados)}` }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    server.registerTool("ibge_pib_municipios", {
        title: "Consultar PIB dos Municípios",
        description: `Consulta o PIB dos municípios brasileiros (tabela 5938 do SIDRA).
Args:
  - municipio_id (opcional): código IBGE de 7 dígitos do município
  - estado_id (opcional): código IBGE de 2 dígitos do estado (retorna todos municípios do estado)
  - ano (opcional): ano de referência (padrão: mais recente)
Retorna: PIB em mil reais e PIB per capita.`,
        inputSchema: zod_1.z.object({
            municipio_id: zod_1.z.string().optional().describe("Código IBGE do município (7 dígitos, ex: '3550308' para São Paulo)"),
            estado_id: zod_1.z.string().optional().describe("Código IBGE do estado (2 dígitos, ex: '35' para SP)"),
            ano: zod_1.z.string().optional().describe("Ano de referência (ex: '2021')"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ municipio_id, estado_id, ano }) => {
        try {
            const periodo = ano ?? "last";
            let localidade;
            if (municipio_id)
                localidade = `N6[${municipio_id}]`;
            else if (estado_id)
                localidade = `N6[in%20N3[${estado_id}]]`;
            else
                localidade = "N6[all]";
            const url = `${ibge_client_js_1.IBGE_API.v3}/agregados/5938/periodos/${periodo}/variaveis/37|497?localidades=${localidade}`;
            const dados = await (0, ibge_client_js_1.ibgeFetch)(url);
            return { content: [{ type: "text", text: (0, ibge_client_js_1.truncateIfNeeded)(`**PIB dos Municípios** (${periodo})\n${formatarResultadoSidra(dados)}`) }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    server.registerTool("ibge_populacao_censo2022", {
        title: "Consultar População — Censo 2022",
        description: `Consulta dados de população do Censo Demográfico 2022.
Args:
  - nivel: "BR"=Brasil, "REGIOES"=por região, "ESTADOS"=por estado,
    "municipio"=município específico (requer municipio_id),
    "estado_municipios"=municípios de um estado (requer estado_id)
  - municipio_id (opcional): código IBGE de 7 dígitos
  - estado_id (opcional): código IBGE de 2 dígitos
Retorna: população residente total pelo Censo 2022.`,
        inputSchema: zod_1.z.object({
            nivel: zod_1.z.enum(["BR", "REGIOES", "ESTADOS", "municipio", "estado_municipios"])
                .describe("Nível territorial da consulta"),
            municipio_id: zod_1.z.string().optional().describe("Código IBGE do município (7 dígitos)"),
            estado_id: zod_1.z.string().optional().describe("Código IBGE do estado (2 dígitos)"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ nivel, municipio_id, estado_id }) => {
        try {
            let localidade;
            switch (nivel) {
                case "BR":
                    localidade = "N1[all]";
                    break;
                case "REGIOES":
                    localidade = "N2[all]";
                    break;
                case "ESTADOS":
                    localidade = "N3[all]";
                    break;
                case "municipio":
                    if (!municipio_id)
                        return { content: [{ type: "text", text: "Erro: municipio_id obrigatório quando nivel='municipio'" }] };
                    localidade = `N6[${municipio_id}]`;
                    break;
                case "estado_municipios":
                    if (!estado_id)
                        return { content: [{ type: "text", text: "Erro: estado_id obrigatório quando nivel='estado_municipios'" }] };
                    localidade = `N6[in%20N3[${estado_id}]]`;
                    break;
                default: localidade = "N1[all]";
            }
            const url = `${ibge_client_js_1.IBGE_API.v3}/agregados/9514/periodos/2022/variaveis/93?localidades=${localidade}`;
            const dados = await (0, ibge_client_js_1.ibgeFetch)(url);
            return { content: [{ type: "text", text: (0, ibge_client_js_1.truncateIfNeeded)(`**População — Censo 2022** | ${nivel}\n${formatarResultadoSidra(dados)}`) }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    // ─── EDUCAÇÃO / ALFABETIZAÇÃO ─────────────────────────────────────────────
    server.registerTool("ibge_alfabetizacao_municipios", {
        title: "Taxa de Alfabetização dos Municípios — Censo 2022",
        description: `Consulta a taxa de alfabetização (15 anos ou mais) por município com ranking.
Tabela IBGE: 9543 (Censo 2022), Variável 2513.

Args:
  - estado_id (string, opcional): 2 dígitos do estado (ex: "35"=SP, "31"=MG, "29"=BA, "26"=PE)
    Sem estado_id = consulta as 27 capitais brasileiras.
  - top_n (number): quantos retornar no ranking (padrão 20, máx 100)
  - ordenar: "maior" (melhor taxa) | "menor" (pior taxa)

Exemplos:
  - "Mais alfabetizados em SP" → estado_id:"35", top_n:20
  - "Pior escolaridade na BA" → estado_id:"29", ordenar:"menor"
  - "Ranking das capitais" → sem estado_id`,
        inputSchema: zod_1.z.object({
            estado_id: zod_1.z.string().regex(/^\d{2}$/).optional()
                .describe("Código IBGE do estado (2 dígitos ex: 35=SP, 31=MG, 29=BA)"),
            top_n: zod_1.z.number().int().min(1).max(100).default(20)
                .describe("Quantos municípios retornar (padrão 20)"),
            ordenar: zod_1.z.enum(["maior", "menor"]).default("maior")
                .describe("maior = melhor taxa primeiro | menor = pior taxa primeiro"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ estado_id, top_n, ordenar }) => {
        const CAPITAIS_IDS = "1302603,1501402,1100205,1200401,1400100,1600303,1721000,2111300,2211001,2304400,2408102,2507507,2611606,2704302,2800308,2927408,3106200,3304557,3550308,3205309,4106902,4205407,4314902,5002704,5103403,5208707,5300108";
        try {
            const localidade = estado_id
                ? `N6[in%20N3[${estado_id}]]`
                : `N6[${CAPITAIS_IDS}]`;
            const escopo = estado_id ? `estado código ${estado_id}` : "27 capitais brasileiras";
            const url = `${ibge_client_js_1.IBGE_API.v3}/agregados/9543/periodos/2022/variaveis/2513?localidades=${localidade}`;
            const dados = await (0, ibge_client_js_1.ibgeFetch)(url);
            const series = dados?.[0]?.resultados?.[0]?.series ?? [];
            if (series.length === 0) {
                return { content: [{ type: "text", text: `Nenhum dado. Use estado_id com 2 dígitos (ex: "35" para SP).` }] };
            }
            const municipios = series
                .map((s) => ({
                id: s.localidade.id,
                nome: s.localidade.nome,
                taxa: parseFloat(Object.values(s.serie)[0] ?? "0"),
            }))
                .filter((m) => m.taxa > 0);
            municipios.sort((a, b) => ordenar === "maior" ? b.taxa - a.taxa : a.taxa - b.taxa);
            const recorte = municipios.slice(0, top_n);
            const media = municipios.reduce((acc, m) => acc + m.taxa, 0) / municipios.length;
            const titulo = ordenar === "maior"
                ? `🏆 Top ${top_n} — Maior Taxa de Alfabetização (${escopo})`
                : `⚠️ Top ${top_n} — Menor Taxa de Alfabetização (${escopo})`;
            const linhas = recorte.map((m, i) => {
                const pos = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`;
                return `| ${pos} | ${m.nome} | **${m.taxa.toFixed(2)}%** |`;
            });
            return {
                content: [{
                        type: "text", text: (0, ibge_client_js_1.truncateIfNeeded)(`## ${titulo}\n` +
                            `**Total consultado:** ${municipios.length} municípios | **Média:** ${media.toFixed(2)}%\n\n` +
                            `| # | Município | Taxa de Alfabetização |\n` +
                            `|---|-----------|----------------------|\n` +
                            linhas.join("\n") +
                            `\n\n_Fonte: IBGE Censo 2022, Tabela 9543 — pessoas de 15+ que sabem ler e escrever_`)
                    }]
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
    server.registerTool("ibge_pib_estados", {
        title: "PIB dos Estados",
        description: `Consulta o Produto Interno Bruto (PIB) dos estados brasileiros.
Dados oficiais do IBGE para análise econômica regional.

Args:
  - ano (obrigatório): Ano do PIB (ex: 2021, 2020, 2019...)
  - uf_id (opcional): ID do estado específico (ex: 35=SP). Omita para todos os estados.
  - per_capita (opcional): true para PIB per capita, false para PIB total (padrão: false)

Retorna ranking de PIB com participação percentual no total nacional.
Exemplo: "Qual o PIB de São Paulo em 2021?" ou "Ranking de PIB dos estados"`,
        inputSchema: zod_1.z.object({
            ano: zod_1.z.number().int().min(1995).max(2030).describe("Ano do PIB (ex: 2021)"),
            uf_id: zod_1.z.number().int().positive().optional().describe("ID do estado (ex: 35=SP). Omita para todos."),
            per_capita: zod_1.z.boolean().default(false).describe("true=PIB per capita, false=PIB total"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ ano, uf_id, per_capita }) => {
        try {
            const localidade = uf_id ? `N3[${uf_id}]` : "N3[all]";
            const variavel = per_capita ? "47" : "37"; // 37=PIB total, 47=PIB per capita
            const url = `${ibge_client_js_1.IBGE_API.v3}/agregados/5938/periodos/${ano}/variaveis/${variavel}?localidades=${localidade}&view=flat`;
            const dados = await (0, ibge_client_js_1.ibgeFetch)(url, cache_js_1.TTL.SIDRA_DATA);
            const series = dados?.[0]?.resultados?.[0]?.series ?? [];
            if (series.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: `Dados não encontrados para ${ano}.\n\nVerifique se o ano está disponível. Dados de PIB geralmente têm 2-3 anos de defasagem.`
                        }]
                };
            }
            const estados = series.map((s) => ({
                nome: s.localidade.nome,
                id: s.localidade.id,
                valor: parseFloat(Object.values(s.serie)[0] ?? "0"),
            })).filter((e) => e.valor > 0);
            estados.sort((a, b) => b.valor - a.valor);
            if (uf_id && estados.length === 1) {
                // Resultado único
                const estado = estados[0];
                const valorFormatado = per_capita
                    ? `R$ ${estado.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : `R$ ${(estado.valor / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 3 })} mil`;
                return {
                    content: [{
                            type: "text",
                            text: `## ${estado.nome} — PIB ${ano}\n\n**${per_capita ? "PIB per capita" : "PIB total"}:** ${valorFormatado}\n\n_Fonte: IBGE PIB dos Municípios (Tabela 5938)_`
                        }]
                };
            }
            // Múltiplos estados - ranking
            const total = estados.reduce((acc, e) => acc + e.valor, 0);
            const linhas = estados.map((e, i) => {
                const pct = ((e.valor / total) * 100).toFixed(2);
                const valorFormatado = per_capita
                    ? `R$ ${e.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : `R$ ${(e.valor / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 0 })} mil`;
                return `${i + 1}. **${e.nome}**: ${valorFormatado}${per_capita ? "" : ` (${pct}%)`}`;
            });
            const titulo = per_capita ? "PIB per capita" : "PIB total";
            const totalFormatado = per_capita
                ? ""
                : `\n**Brasil:** R$ ${(total / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 0 })} mil`;
            return {
                content: [{
                        type: "text",
                        text: (0, ibge_client_js_1.truncateIfNeeded)(`## ${titulo} por Estado — ${ano}${totalFormatado}\n\n` +
                            linhas.join("\n") +
                            `\n\n_Fonte: IBGE PIB dos Municípios (Tabela 5938)_\n_${per_capita ? "Valores em reais por habitante" : "Valores em milhares de reais"}_`)
                    }]
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: (0, ibge_client_js_1.formatToolError)(err) }] };
        }
    });
}
//# sourceMappingURL=sidra.js.map