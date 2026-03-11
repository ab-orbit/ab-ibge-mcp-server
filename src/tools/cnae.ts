// tools/cnae.ts — CNAE: Classificação Nacional de Atividades Econômicas
// API: https://servicodados.ibge.gov.br/api/v2/cnae/
// Hierarquia: Seção (21) > Divisão (87) > Grupo (285) > Classe (673) > Subclasse (1301)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IBGE_API, ibgeFetch, formatToolError, truncateIfNeeded } from "../services/ibge-client.js";
import type { ToolResponse } from "../types.js";

// ─── Tipos da API CNAE ──────────────────────────────────────────────────────

interface CnaeSecao {
  id: string;   // "A", "B", ..., "U"
  nome: string;
}

interface CnaeDivisao {
  id: string;   // "01", "02", ..., "99"
  nome: string;
  secao?: CnaeSecao;
}

interface CnaeGrupo {
  id: string;   // "01.1", "47.1", etc.
  nome: string;
  divisao?: CnaeDivisao;
}

interface CnaeClasse {
  id: string;   // "0111-3", "4711-3", etc.
  nome: string;
  grupo?: CnaeGrupo;
  observacoes?: string;
}

interface CnaeSubclasse {
  id: string;   // "0111-3/01", "4711-3/02", etc.
  descricao: string;
  observacoes?: string;
  classe: {
    id: string;
    nome: string;
    observacoes?: string;
    grupo: {
      id: string;
      nome: string;
      divisao: {
        id: string;
        nome: string;
        secao: { id: string; nome: string };
      };
    };
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatarCaminhoHierarquico(sub: CnaeSubclasse): string {
  const s = sub.classe.grupo.divisao.secao;
  const d = sub.classe.grupo.divisao;
  const g = sub.classe.grupo;
  const c = sub.classe;
  return [
    `📌 **Subclasse ${sub.id}** — ${sub.descricao}`,
    `   Classe:   ${c.id} — ${c.nome}`,
    `   Grupo:    ${g.id} — ${g.nome}`,
    `   Divisão:  ${d.id} — ${d.nome}`,
    `   Seção:    ${s.id} — ${s.nome}`,
    ...(sub.observacoes ? [`   ⚠️ Obs: ${sub.observacoes}`] : []),
  ].join("\n");
}

// ─── Registro das Tools ──────────────────────────────────────────────────────

export function registerCnaeTools(server: McpServer): void {

  // ── Tool 1: busca textual ──────────────────────────────────────────────────
  server.registerTool(
    "ibge_cnae_buscar",
    {
      title: "Buscar Atividade Econômica na CNAE",
      description: `Busca atividades econômicas na CNAE (Classificação Nacional de Atividades Econômicas) por palavra-chave.
Retorna subclasses com hierarquia completa: Seção > Divisão > Grupo > Classe > Subclasse.

Use para:
  - Identificar o código CNAE de uma atividade ("qual CNAE de padaria?", "CNAE de software?")
  - Verificar se uma atividade pertence a um setor ("é comércio ou serviço?")
  - Encontrar atividades similares dentro de um setor

Args:
  - termo: palavra-chave em português (ex: "padaria", "software", "construção civil", "restaurante")
  - secao_id (opcional): letra da seção para restringir busca (ex: "C"=Indústria, "G"=Comércio, "J"=TI)
  - max_resultados: máximo de resultados (padrão 10, máx 50)

Seções principais: A=Agro, B=Mineração, C=Indústria, D=Energia, E=Saneamento,
  F=Construção, G=Comércio, H=Transporte, I=Alojamento/Alimentação, J=Info/TI,
  K=Financeiro, L=Imóveis, M=Profissional/Técnico, N=Administrativo, O=Adm.Pública,
  P=Educação, Q=Saúde, R=Arte/Cultura, S=Outros Serviços, T=Doméstico, U=Organismos Int'l`,
      inputSchema: z.object({
        termo: z.string().min(2).describe("Palavra-chave para buscar (ex: 'padaria', 'software', 'engenharia')"),
        secao_id: z.string().length(1).toUpperCase().optional()
          .describe("Letra da seção CNAE para filtrar (ex: 'C' para indústria, 'G' para comércio)"),
        max_resultados: z.number().int().min(1).max(50).default(10)
          .describe("Máximo de resultados a retornar (padrão 10)"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ termo, secao_id, max_resultados }): Promise<ToolResponse> => {
      try {
        const subclasses = await ibgeFetch<CnaeSubclasse[]>(`${IBGE_API.v2}/cnae/subclasses`);
        const termoNorm = normalizar(termo);
        const termos = termoNorm.split(/\s+/).filter((t) => t.length >= 2);

        const resultados = subclasses.filter((sub) => {
          // Filtro por seção
          if (secao_id && sub.classe.grupo.divisao.secao.id !== secao_id.toUpperCase()) return false;
          // Busca por todos os termos nos campos de nome/descrição (AND implícito)
          const textoCompleto = normalizar([
            sub.descricao,
            sub.classe.nome,
            sub.classe.grupo.nome,
            sub.classe.grupo.divisao.nome,
          ].join(" "));
          return termos.every((t) => textoCompleto.includes(t));
        });

        if (resultados.length === 0) {
          // Tentar busca OR (qualquer termo)
          const resultadosOR = subclasses.filter((sub) => {
            if (secao_id && sub.classe.grupo.divisao.secao.id !== secao_id.toUpperCase()) return false;
            const textoCompleto = normalizar([sub.descricao, sub.classe.nome, sub.classe.grupo.nome].join(" "));
            return termos.some((t) => textoCompleto.includes(t));
          });
          if (resultadosOR.length === 0) {
            return {
              content: [{
                type: "text",
                text: `Nenhuma atividade encontrada para "${termo}"${secao_id ? ` na seção ${secao_id}` : ""}.\n\n` +
                  `Tente termos mais genéricos (ex: "comércio alimentos" em vez de "mercearia").\n` +
                  `Use ibge_cnae_secoes para ver todas as seções disponíveis.`
              }]
            };
          }
          // Retorna resultados OR com aviso
          const recorte = resultadosOR.slice(0, max_resultados);
          const linhas = recorte.map(formatarCaminhoHierarquico).join("\n\n");
          return {
            content: [{
              type: "text",
              text: truncateIfNeeded(
                `**CNAE — Resultados para "${termo}"** (busca ampliada — ${resultadosOR.length} encontrados, mostrando ${recorte.length})\n\n${linhas}`
              )
            }]
          };
        }

        const recorte = resultados.slice(0, max_resultados);
        const linhas = recorte.map(formatarCaminhoHierarquico).join("\n\n");
        const aviso = resultados.length > max_resultados
          ? `\n\n⚠️ ${resultados.length} resultados encontrados. Mostrando ${max_resultados}. Use secao_id ou termo mais específico para refinar.`
          : "";

        return {
          content: [{
            type: "text",
            text: truncateIfNeeded(
              `**CNAE — "${termo}"** — ${resultados.length} atividade(s) encontrada(s)\n\n${linhas}${aviso}`
            )
          }]
        };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );

  // ── Tool 2: detalhar por código ────────────────────────────────────────────
  server.registerTool(
    "ibge_cnae_detalhar",
    {
      title: "Detalhar Código CNAE",
      description: `Retorna detalhes completos de um código CNAE em qualquer nível hierárquico.
Aceita código de seção, divisão, grupo, classe ou subclasse.

Args:
  - codigo: código CNAE em qualquer nível:
      Seção:     1 letra      ex: "G"
      Divisão:   2 dígitos    ex: "47"
      Grupo:     4 chars      ex: "47.1"
      Classe:    6 chars      ex: "4711-3"
      Subclasse: 9 chars      ex: "4711-3/02"

Retorna: nome, hierarquia completa e, para classes/subclasses, as atividades incluídas.`,
      inputSchema: z.object({
        codigo: z.string().min(1).max(10).describe(
          "Código CNAE: seção ('G'), divisão ('47'), grupo ('47.1'), classe ('4711-3') ou subclasse ('4711-3/02')"
        ),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ codigo }): Promise<ToolResponse> => {
      try {
        const cod = codigo.trim().toUpperCase();

        // Detectar nível pelo formato do código
        let nivel: "secao" | "divisao" | "grupo" | "classe" | "subclasse";
        if (/^[A-U]$/.test(cod)) nivel = "secao";
        else if (/^\d{2}$/.test(cod)) nivel = "divisao";
        else if (/^\d{2}\.\d$/.test(cod)) nivel = "grupo";
        else if (/^\d{4}-\d$/.test(cod)) nivel = "classe";
        else if (/^\d{4}-\d\/\d{2}$/.test(cod)) nivel = "subclasse";
        else {
          return {
            content: [{
              type: "text",
              text: `Formato de código não reconhecido: "${codigo}".\n\n` +
                `Formatos válidos:\n` +
                `  Seção:     1 letra         ex: "G"\n` +
                `  Divisão:   2 dígitos       ex: "47"\n` +
                `  Grupo:     "NN.N"          ex: "47.1"\n` +
                `  Classe:    "NNNN-N"        ex: "4711-3"\n` +
                `  Subclasse: "NNNN-N/NN"     ex: "4711-3/02"`
            }]
          };
        }

        // Seção
        if (nivel === "secao") {
          const secao = await ibgeFetch<CnaeSecao>(`${IBGE_API.v2}/cnae/secoes/${cod}`);
          const divisoes = await ibgeFetch<CnaeDivisao[]>(`${IBGE_API.v2}/cnae/secoes/${cod}/divisoes`);
          const linhasDivisoes = divisoes.map((d) => `  ${d.id} — ${d.nome}`).join("\n");
          return {
            content: [{
              type: "text",
              text: [
                `**Seção ${secao.id} — ${secao.nome}**`,
                `Nível: Seção (topo da hierarquia CNAE)`,
                ``,
                `📂 Divisões (${divisoes.length}):`,
                linhasDivisoes,
                ``,
                `💡 Para ver grupos: ibge_cnae_detalhar("${divisoes[0]?.id ?? "XX"}")`,
              ].join("\n")
            }]
          };
        }

        // Divisão
        if (nivel === "divisao") {
          const divisao = await ibgeFetch<CnaeDivisao>(`${IBGE_API.v2}/cnae/divisoes/${cod}`);
          const grupos = await ibgeFetch<CnaeGrupo[]>(`${IBGE_API.v2}/cnae/divisoes/${cod}/grupos`);
          const secNome = (divisao as CnaeDivisao & { secao?: CnaeSecao }).secao?.nome ?? "—";
          const linhasGrupos = grupos.map((g) => `  ${g.id} — ${g.nome}`).join("\n");
          return {
            content: [{
              type: "text",
              text: [
                `**Divisão ${divisao.id} — ${divisao.nome}**`,
                `Seção: ${secNome}`,
                ``,
                `📂 Grupos (${grupos.length}):`,
                linhasGrupos,
              ].join("\n")
            }]
          };
        }

        // Grupo
        if (nivel === "grupo") {
          const grupo = await ibgeFetch<CnaeGrupo>(`${IBGE_API.v2}/cnae/grupos/${cod}`);
          const classes = await ibgeFetch<CnaeClasse[]>(`${IBGE_API.v2}/cnae/grupos/${cod}/classes`);
          const linhasClasses = classes.map((c) => `  ${c.id} — ${c.nome}`).join("\n");
          const divNome = (grupo as CnaeGrupo & { divisao?: CnaeDivisao }).divisao?.nome ?? "—";
          return {
            content: [{
              type: "text",
              text: [
                `**Grupo ${grupo.id} — ${grupo.nome}**`,
                `Divisão: ${divNome}`,
                ``,
                `📂 Classes (${classes.length}):`,
                linhasClasses,
                ``,
                `💡 Para ver subclasses: ibge_cnae_detalhar("${classes[0]?.id ?? "XXXX-N"}")`,
              ].join("\n")
            }]
          };
        }

        // Classe
        if (nivel === "classe") {
          const classe = await ibgeFetch<CnaeClasse>(`${IBGE_API.v2}/cnae/classes/${cod}`);
          const subclasses = await ibgeFetch<CnaeSubclasse[]>(`${IBGE_API.v2}/cnae/classes/${cod}/subclasses`);
          const linhasSubs = subclasses.map((s) =>
            `  ${s.id} — ${s.descricao}${s.observacoes ? `\n    ⚠️ ${s.observacoes}` : ""}`
          ).join("\n");
          const grupoNome = (classe as CnaeClasse & { grupo?: CnaeGrupo }).grupo?.nome ?? "—";
          return {
            content: [{
              type: "text",
              text: [
                `**Classe ${classe.id} — ${classe.nome}**`,
                `Grupo: ${grupoNome}`,
                ...(classe.observacoes ? [`⚠️ Obs: ${classe.observacoes}`] : []),
                ``,
                `📂 Subclasses (${subclasses.length}):`,
                linhasSubs,
              ].join("\n")
            }]
          };
        }

        // Subclasse — busca via lista completa (não há endpoint direto de subclasse por ID)
        const todasSubs = await ibgeFetch<CnaeSubclasse[]>(`${IBGE_API.v2}/cnae/subclasses`);
        const sub = todasSubs.find((s) => s.id === cod || s.id === codigo.trim());
        if (!sub) {
          return {
            content: [{
              type: "text",
              text: `Subclasse "${codigo}" não encontrada.\nVerifique o formato: "NNNN-N/NN" (ex: "4711-3/02").\nUse ibge_cnae_buscar para encontrar pelo nome da atividade.`
            }]
          };
        }
        return {
          content: [{
            type: "text",
            text: [
              formatarCaminhoHierarquico(sub),
              ``,
              `💡 Para ver todas as subclasses da mesma classe: ibge_cnae_detalhar("${sub.classe.id}")`,
            ].join("\n")
          }]
        };

      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );

  // ── Tool 3: listar seções ──────────────────────────────────────────────────
  server.registerTool(
    "ibge_cnae_secoes",
    {
      title: "Listar Seções da CNAE",
      description: `Lista as 21 seções da CNAE com contagem de divisões.
Use para ter uma visão geral da estrutura ou descobrir a letra de seção para filtrar ibge_cnae_buscar.

Seções: A(Agro) B(Mineração) C(Indústria) D(Energia) E(Saneamento) F(Construção)
  G(Comércio) H(Transporte) I(Alimentação) J(Informação/TI) K(Financeiro) L(Imóveis)
  M(Profissional) N(Administrativo) O(Adm.Pública) P(Educação) Q(Saúde)
  R(Arte/Esporte) S(Outros Serviços) T(Doméstico) U(Organismos Internacionais)`,
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (): Promise<ToolResponse> => {
      try {
        const secoes = await ibgeFetch<CnaeSecao[]>(`${IBGE_API.v2}/cnae/secoes`);
        const linhas = secoes.map((s) => `  **${s.id}** — ${s.nome}`).join("\n");
        return {
          content: [{
            type: "text",
            text: [
              `**CNAE 2.0 — ${secoes.length} Seções**`,
              `Hierarquia: Seção > Divisão > Grupo > Classe > Subclasse`,
              `Total: 21 seções | 87 divisões | 285 grupos | 673 classes | 1.301 subclasses`,
              ``,
              linhas,
              ``,
              `💡 Use ibge_cnae_buscar(termo="...", secao_id="X") para buscar dentro de uma seção.`,
              `💡 Use ibge_cnae_detalhar("X") para ver as divisões de uma seção.`,
            ].join("\n")
          }]
        };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    }
  );

}
