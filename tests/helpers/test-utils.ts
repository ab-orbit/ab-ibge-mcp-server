import { ibgeFetch, IBGE_API } from "../../src/services/ibge-client.js";
import { expect } from "vitest";

/**
 * Valida que uma resposta de ferramenta tem a estrutura correta
 */
export function expectValidToolResponse(response: any) {
  expect(response).toBeDefined();
  expect(response).toHaveProperty("content");
  expect(Array.isArray(response.content)).toBe(true);
  expect(response.content.length).toBeGreaterThan(0);
  expect(response.content[0]).toHaveProperty("type", "text");
  expect(response.content[0]).toHaveProperty("text");
  expect(typeof response.content[0].text).toBe("string");
  expect(response.content[0].text.length).toBeGreaterThan(0);
}

/**
 * Valida que uma resposta não contém erro
 */
export function expectNoError(response: any) {
  const text = response.content[0].text;
  expect(text).not.toMatch(/Erro na API do IBGE/i);
  expect(text).not.toMatch(/Erro inesperado/i);
  expect(text).not.toMatch(/status 500/i);
  expect(text).not.toMatch(/status 404/i);
}

/**
 * Valida que uma resposta contém dados (não está vazia)
 */
export function expectHasData(response: any) {
  const text = response.content[0].text;
  expect(text).not.toMatch(/Nenhum.*encontrad[oa]/i);
  expect(text).not.toMatch(/Nenhum dado/i);
  expect(text.length).toBeGreaterThan(50); // Resposta não trivial
}

/**
 * Helper para testar chamadas diretas à API IBGE
 */
export async function testIBGEEndpoint<T>(
  url: string,
  validator?: (data: T) => void
): Promise<T> {
  const data = await ibgeFetch<T>(url);
  expect(data).toBeDefined();
  if (validator) {
    validator(data);
  }
  return data;
}

/**
 * Helper para delay entre testes (evitar rate limiting)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Códigos IBGE comuns para testes
 */
export const TEST_CODES = {
  // Estados
  SP: "35", // São Paulo
  RJ: "33", // Rio de Janeiro
  MG: "31", // Minas Gerais
  BA: "29", // Bahia

  // Municípios (7 dígitos)
  SAO_PAULO: "3550308",
  RIO_JANEIRO: "3304557",
  BELO_HORIZONTE: "3106200",
  SALVADOR: "2927408",
  BRASILIA: "5300108",
} as const;

/**
 * Anos de teste comuns
 */
export const TEST_YEARS = {
  CENSO_2022: "2022",
  CENSO_2010: "2010",
  PIB_RECENTE: "2021",
  IPCA_YEAR: "2023",
} as const;

/**
 * Valida estrutura de localidade
 */
export function expectValidLocalidade(loc: any) {
  expect(loc).toHaveProperty("id");
  expect(loc).toHaveProperty("nome");
  expect(typeof loc.id).toBe("number");
  expect(typeof loc.nome).toBe("string");
}

/**
 * Valida estrutura de série SIDRA
 */
export function expectValidSidraSerie(serie: any) {
  expect(serie).toHaveProperty("localidade");
  expect(serie).toHaveProperty("serie");
  expect(typeof serie.serie).toBe("object");
  expect(Object.keys(serie.serie).length).toBeGreaterThan(0);
}

/**
 * Extrai texto da resposta de ferramenta
 */
export function extractText(response: any): string {
  return response.content[0].text;
}

/**
 * Verifica se resposta contém um padrão
 */
export function expectContains(response: any, pattern: string | RegExp) {
  const text = extractText(response);
  if (typeof pattern === "string") {
    expect(text).toContain(pattern);
  } else {
    expect(text).toMatch(pattern);
  }
}

/**
 * Valida que resposta tem formato de tabela markdown
 */
export function expectMarkdownTable(response: any) {
  const text = extractText(response);
  expect(text).toMatch(/\|.*\|/); // Contém pipes de tabela
  expect(text).toMatch(/---/); // Contém separador de header
}

/**
 * Valida estrutura de resposta SIDRA padrão
 */
export function expectValidSidraResponse(response: any) {
  expectValidToolResponse(response);
  expectNoError(response);
  expectHasData(response);
  const text = extractText(response);
  expect(text).toMatch(/📊|📍/); // Ícones de dados/localização
}
