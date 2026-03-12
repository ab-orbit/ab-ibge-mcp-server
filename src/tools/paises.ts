import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IBGE_API, ibgeFetch, formatToolError, truncateIfNeeded } from "../services/ibge-client.js";
import type { Pais, IndicadorPais, IndicadorPaisSerie, ToolResponse } from "../types.js";

/**
 * Registra ferramentas relacionadas à API de Países do IBGE
 * Endpoint base: https://servicodados.ibge.gov.br/api/v1/paises
 */
export function registerPaisesTools(server: McpServer): void {
  // ─── Lista todos os países ─────────────────────────────────────────────────
  server.registerTool(
    "ibge_listar_paises",
    {
      title: "Listar todos os países",
      description:
        "Retorna lista de todos os países do mundo com informações básicas (nome, código ISO, região). " +
        "Dados incluem: nome em português/inglês/espanhol, códigos ISO-3166 e M49, região e sub-região.\n\n" +
        "**Uso**: Para obter lista completa de países ou filtrar por região.\n" +
        "**Retorna**: Array com nome, códigos ISO-3166-1-ALPHA-2/3, região e sub-região de cada país.",
      inputSchema: z.object({
        orderBy: z
          .enum(["id", "nome"])
          .optional()
          .describe("Ordenar por código M49 (id) ou nome do país. Padrão: 'id'."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ orderBy = "id" }): Promise<ToolResponse> => {
      try {
        const url = `${IBGE_API.v1}/paises?orderBy=${orderBy}`;
        const paises = await ibgeFetch<Pais[]>(url);

        const resumo = paises.map((p) => ({
          codigo_iso2: p.id["ISO-3166-1-ALPHA-2"],
          codigo_iso3: p.id["ISO-3166-1-ALPHA-3"],
          codigo_m49: p.id.M49,
          nome: p.nome.abreviado,
          nome_en: p.nome["abreviado-EN"],
          regiao: p.localizacao.regiao.nome,
          sub_regiao: p.localizacao["sub-regiao"].nome,
        }));

        const texto = `**Países do Mundo** (${paises.length} países)\n\n` + resumo.map((p) => `• **${p.nome}** (${p.codigo_iso2}) — ${p.regiao}, ${p.sub_regiao}`).join("\n");

        return { content: [{ type: "text", text: truncateIfNeeded(texto) }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );

  // ─── Obter informações de um país específico ───────────────────────────────
  server.registerTool(
    "ibge_obter_pais",
    {
      title: "Obter informações detalhadas de um país",
      description:
        "Retorna informações completas sobre um país específico usando código ISO-3166-1-ALPHA-2 (ex: BR, US, PT). " +
        "Dados incluem: área territorial, localização geográfica, línguas oficiais, capital, moeda, histórico.\n\n" +
        "**Parâmetros**:\n" +
        "  • codigo_iso: Código ISO-3166-1-ALPHA-2 (2 letras maiúsculas, ex: 'BR', 'US', 'AR', 'PT')\n\n" +
        "**Retorna**: Nome completo, área (km²), região/sub-região, línguas, capital, moeda, histórico do país.",
      inputSchema: z.object({
        codigo_iso: z
          .string()
          .length(2)
          .toUpperCase()
          .describe("Código ISO-3166-1-ALPHA-2 do país (2 letras maiúsculas, ex: 'BR', 'US', 'PT', 'AR')"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ codigo_iso }): Promise<ToolResponse> => {
      try {
        const url = `${IBGE_API.v1}/paises/${codigo_iso}`;
        const resultado = await ibgeFetch<Pais[]>(url);

        if (!resultado || resultado.length === 0) {
          return { content: [{ type: "text", text: `❌ País não encontrado com código ISO: ${codigo_iso}` }] };
        }

        const pais = resultado[0];

        const texto =
          `**${pais.nome.abreviado}** (${pais.id["ISO-3166-1-ALPHA-2"]})\n\n` +
          `📍 **Localização**\n` +
          `  • Região: ${pais.localizacao.regiao.nome}\n` +
          `  • Sub-região: ${pais.localizacao["sub-regiao"].nome}\n` +
          (pais.localizacao["regiao-intermediaria"] ? `  • Região intermediária: ${pais.localizacao["regiao-intermediaria"].nome}\n` : "") +
          `\n📏 **Área Territorial**\n` +
          `  • ${parseFloat(pais.area.total).toLocaleString("pt-BR")} ${pais.area.unidade.símbolo}\n` +
          `\n🏛️ **Governo**\n` +
          `  • Capital: ${pais.governo.capital.nome}\n` +
          `\n🗣️ **Línguas Oficiais**\n` +
          pais.linguas.map((l) => `  • ${l.nome} (${l.id["ISO-639-1"]})`).join("\n") +
          `\n\n💰 **Moeda(s)**\n` +
          pais["unidades-monetarias"].map((m) => `  • ${m.nome} (${m.id["ISO-4217-ALPHA"]})`).join("\n") +
          `\n\n📜 **Histórico**\n${pais.historico.substring(0, 500)}${pais.historico.length > 500 ? "..." : ""}`;

        return { content: [{ type: "text", text: truncateIfNeeded(texto) }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );

  // ─── Buscar países por nome ────────────────────────────────────────────────
  server.registerTool(
    "ibge_buscar_pais",
    {
      title: "Buscar países por nome",
      description:
        "Busca países cujo nome contenha o termo especificado (busca case-insensitive). " +
        "Útil para encontrar código ISO de um país antes de consultar informações detalhadas.\n\n" +
        "**Parâmetros**:\n" +
        "  • nome: Termo de busca (busca em português, inglês e espanhol)\n\n" +
        "**Retorna**: Lista de países encontrados com códigos ISO e localização.\n\n" +
        "**Exemplo**: nome='brasil' → retorna Brasil (BR/BRA)",
      inputSchema: z.object({
        nome: z.string().min(2).describe("Nome ou parte do nome do país para buscar (mín. 2 caracteres)"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ nome }): Promise<ToolResponse> => {
      try {
        const paises = await ibgeFetch<Pais[]>(`${IBGE_API.v1}/paises`);

        const termo = nome.toLowerCase();
        const encontrados = paises.filter(
          (p) =>
            p.nome.abreviado.toLowerCase().includes(termo) ||
            p.nome["abreviado-EN"].toLowerCase().includes(termo) ||
            p.nome["abreviado-ES"].toLowerCase().includes(termo)
        );

        if (encontrados.length === 0) {
          return { content: [{ type: "text", text: `❌ Nenhum país encontrado com nome contendo: "${nome}"` }] };
        }

        const texto =
          `**Países Encontrados** (${encontrados.length} resultado${encontrados.length > 1 ? "s" : ""})\n\n` +
          encontrados
            .map(
              (p) =>
                `• **${p.nome.abreviado}** (${p.id["ISO-3166-1-ALPHA-2"]} / ${p.id["ISO-3166-1-ALPHA-3"]})\n` +
                `  Capital: ${p.governo.capital.nome} | ${p.localizacao.regiao.nome}`
            )
            .join("\n\n");

        return { content: [{ type: "text", text: truncateIfNeeded(texto) }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );

  // ─── Listar indicadores disponíveis ────────────────────────────────────────
  server.registerTool(
    "ibge_listar_indicadores_paises",
    {
      title: "Listar indicadores disponíveis para países",
      description:
        "Retorna lista completa dos 34 indicadores disponíveis para países, organizados por categoria. " +
        "Categorias: Economia, Indicadores Sociais, Meio Ambiente, População, Redes, Saúde.\n\n" +
        "**Retorna**: ID do indicador, nome completo, unidade de medida (%, US$, pessoas, etc.).\n\n" +
        "**Uso**: Para descobrir quais indicadores estão disponíveis antes de consultar dados.",
      inputSchema: z.object({
        categoria: z
          .enum(["economia", "social", "meio_ambiente", "populacao", "redes", "saude", "todos"])
          .optional()
          .describe("Filtrar por categoria (padrão: 'todos')"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ categoria = "todos" }): Promise<ToolResponse> => {
      try {
        const indicadores = await ibgeFetch<IndicadorPais[]>(`${IBGE_API.v1}/paises/indicadores`);

        let filtrados = indicadores;
        if (categoria !== "todos") {
          const mapa: Record<string, string> = {
            economia: "Economia",
            social: "Indicadores sociais",
            meio_ambiente: "Meio Ambiente",
            populacao: "População",
            redes: "Redes",
            saude: "Saúde",
          };
          const prefixo = mapa[categoria];
          filtrados = indicadores.filter((i) => i.indicador.startsWith(prefixo));
        }

        const porCategoria: Record<string, IndicadorPais[]> = {};
        filtrados.forEach((ind) => {
          const cat = ind.indicador.split(" - ")[0];
          if (!porCategoria[cat]) porCategoria[cat] = [];
          porCategoria[cat].push(ind);
        });

        let texto = `**Indicadores de Países** (${filtrados.length} indicadores)\n\n`;
        for (const [cat, inds] of Object.entries(porCategoria)) {
          texto += `**${cat}** (${inds.length})\n`;
          inds.forEach((i) => {
            const nome = i.indicador.split(" - ")[1];
            const unidade = i.unidade && i.unidade.id ? ` (${i.unidade.id})` : "";
            texto += `  • [${i.id}] ${nome}${unidade}\n`;
          });
          texto += "\n";
        }

        return { content: [{ type: "text", text: truncateIfNeeded(texto) }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );

  // ─── Consultar indicadores de um país ──────────────────────────────────────
  server.registerTool(
    "ibge_indicadores_pais",
    {
      title: "Consultar indicadores de um país",
      description:
        "Retorna séries históricas de um ou mais indicadores para um país específico. " +
        "Indicadores disponíveis: PIB per capita, população, IDH, expectativa de vida, alfabetização, etc.\n\n" +
        "**Parâmetros**:\n" +
        "  • codigo_iso: Código ISO-3166-1-ALPHA-2 do país (ex: 'BR', 'US', 'AR')\n" +
        "  • indicadores: ID(s) do(s) indicador(es) separados por | (ex: '77823' ou '77823|77831')\n\n" +
        "**Retorna**: Séries temporais com valores anuais de cada indicador.\n\n" +
        "**Exemplos de indicadores**:\n" +
        "  • 77823: PIB per capita (US$)\n" +
        "  • 77831: Índice de desenvolvimento humano (IDH)\n" +
        "  • 77849: População total\n" +
        "  • 77830: Esperança de vida ao nascer (anos)\n" +
        "  • 77836: Taxa de alfabetização (%)\n\n" +
        "Use ibge_listar_indicadores_paises para ver todos os 34 indicadores disponíveis.",
      inputSchema: z.object({
        codigo_iso: z.string().length(2).toUpperCase().describe("Código ISO-3166-1-ALPHA-2 do país (2 letras)"),
        indicadores: z
          .string()
          .describe("ID(s) do(s) indicador(es) separados por | (pipe). Ex: '77823' ou '77823|77831|77849'"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ codigo_iso, indicadores }): Promise<ToolResponse> => {
      try {
        // Encode pipe character for URL
        const indicadoresEncoded = indicadores.replace(/\|/g, "%7C");
        const url = `${IBGE_API.v1}/paises/${codigo_iso}/indicadores/${indicadoresEncoded}`;
        const dados = await ibgeFetch<IndicadorPaisSerie[]>(url);

        if (!dados || dados.length === 0) {
          return { content: [{ type: "text", text: `❌ Nenhum dado encontrado para ${codigo_iso} com indicadores: ${indicadores}` }] };
        }

        // Validar estrutura de dados
        if (!dados[0] || !dados[0].series || dados[0].series.length === 0 || !dados[0].series[0] || !dados[0].series[0].pais) {
          return { content: [{ type: "text", text: `❌ Estrutura de dados inválida retornada pela API` }] };
        }

        let texto = `**Indicadores - ${dados[0].series[0].pais.nome}** (${codigo_iso})\n\n`;

        for (const indicador of dados) {
          if (!indicador || !indicador.series || indicador.series.length === 0) {
            continue; // Skip invalid indicators
          }

          const unidadeTexto = indicador.unidade && indicador.unidade.id ? ` (${indicador.unidade.id})` : "";
          texto += `📊 **${indicador.indicador}**${unidadeTexto}\n`;

          const serie = indicador.series[0].serie;
          const valores = serie
            .map((obj) => {
              const ano = Object.keys(obj)[0];
              const valor = Object.values(obj)[0];
              if (ano === "-" || valor === null) return null;
              return { ano, valor };
            })
            .filter((v) => v !== null)
            .slice(-10); // Últimos 10 valores

          if (valores.length === 0) {
            texto += "  ⚠️ Sem dados disponíveis\n\n";
            continue;
          }

          valores.forEach((v) => {
            const valorFormatado = parseFloat(v!.valor).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            const unidade = indicador.unidade && indicador.unidade.id ? ` ${indicador.unidade.id}` : "";
            texto += `  • ${v!.ano}: ${valorFormatado}${unidade}\n`;
          });

          texto += "\n";
        }

        return { content: [{ type: "text", text: truncateIfNeeded(texto) }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );

  // ─── Comparar indicadores entre países ─────────────────────────────────────
  server.registerTool(
    "ibge_comparar_paises",
    {
      title: "Comparar indicadores entre múltiplos países",
      description:
        "Compara um indicador específico entre vários países, mostrando os valores mais recentes. " +
        "Útil para análises comparativas e rankings internacionais.\n\n" +
        "**Parâmetros**:\n" +
        "  • codigos_iso: Códigos ISO-3166-1-ALPHA-2 separados por | (ex: 'BR|AR|CL|UY')\n" +
        "  • indicador_id: ID do indicador a comparar (ex: 77823 para PIB per capita)\n\n" +
        "**Retorna**: Ranking dos países com o valor mais recente do indicador.\n\n" +
        "**Exemplo**: comparar PIB per capita entre países da América do Sul:\n" +
        "  • codigos_iso: 'BR|AR|CL|UY|PY|BO|PE|EC|CO|VE'\n" +
        "  • indicador_id: '77823'",
      inputSchema: z.object({
        codigos_iso: z.string().describe("Códigos ISO-3166-1-ALPHA-2 separados por | (ex: 'BR|AR|US|PT')"),
        indicador_id: z.string().describe("ID do indicador a comparar (ex: 77823 para PIB per capita)"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ codigos_iso, indicador_id }): Promise<ToolResponse> => {
      try {
        const paises = codigos_iso.split("|");
        const resultados: Array<{ pais: string; codigo: string; valor: number; ano: string }> = [];

        for (const codigo of paises) {
          const url = `${IBGE_API.v1}/paises/${codigo.trim()}/indicadores/${indicador_id}`;
          const dados = await ibgeFetch<IndicadorPaisSerie[]>(url);

          if (!dados || dados.length === 0) continue;

          const indicador = dados[0];
          const serie = indicador.series[0].serie;

          // Pegar o valor mais recente (não nulo)
          const valoresRecentes = serie
            .map((obj) => {
              const ano = Object.keys(obj)[0];
              const valor = Object.values(obj)[0];
              if (ano === "-" || valor === null) return null;
              return { ano, valor: parseFloat(valor) };
            })
            .filter((v) => v !== null && !isNaN(v!.valor))
            .reverse();

          if (valoresRecentes.length > 0) {
            resultados.push({
              pais: indicador.series[0].pais.nome,
              codigo: codigo.trim(),
              valor: valoresRecentes[0]!.valor,
              ano: valoresRecentes[0]!.ano,
            });
          }
        }

        if (resultados.length === 0) {
          return { content: [{ type: "text", text: `❌ Nenhum dado disponível para comparação` }] };
        }

        // Ordenar por valor (decrescente)
        resultados.sort((a, b) => b.valor - a.valor);

        const indicadorInfo = await ibgeFetch<IndicadorPais[]>(`${IBGE_API.v1}/paises/indicadores`);
        const indicadorNome = indicadorInfo.find((i) => i.id === parseInt(indicador_id))?.indicador || `Indicador ${indicador_id}`;
        const unidade = indicadorInfo.find((i) => i.id === parseInt(indicador_id))?.unidade?.id || "";

        let texto = `**Comparação Internacional** — ${indicadorNome}\n\n`;
        texto += `📊 Ranking de ${resultados.length} países:\n\n`;

        resultados.forEach((r, idx) => {
          const valorFormatado = r.valor.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          const emoji = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
          texto += `${emoji} **${r.pais}** (${r.codigo}): ${valorFormatado} ${unidade} (${r.ano})\n`;
        });

        return { content: [{ type: "text", text: truncateIfNeeded(texto) }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );
}
