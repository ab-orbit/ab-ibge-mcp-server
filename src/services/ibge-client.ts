// services/ibge-client.ts
// Cliente HTTP centralizado para todas as APIs do IBGE

export const IBGE_API = {
  v1: "https://servicodados.ibge.gov.br/api/v1",
  v2: "https://servicodados.ibge.gov.br/api/v2",
  v3: "https://servicodados.ibge.gov.br/api/v3",
} as const;

export class IBGEApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly endpoint?: string
  ) {
    super(message);
    this.name = "IBGEApiError";
  }
}

export async function ibgeFetch<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new IBGEApiError(
        `IBGE API retornou status ${response.status}: ${response.statusText}`,
        response.status,
        url
      );
    }

    const data = (await response.json()) as T;
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof IBGEApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new IBGEApiError("Timeout: a API do IBGE demorou mais de 15s", undefined, url);
    }
    throw new IBGEApiError(
      `Erro ao conectar com a API do IBGE: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      url
    );
  }
}

export function formatToolError(err: unknown): string {
  if (err instanceof IBGEApiError) {
    return `Erro na API do IBGE: ${err.message}${err.endpoint ? `\nEndpoint: ${err.endpoint}` : ""}`;
  }
  return `Erro inesperado: ${err instanceof Error ? err.message : String(err)}`;
}

export function truncateIfNeeded(text: string, maxChars = 50000): string {
  if (text.length <= maxChars) return text;
  return (
    text.slice(0, maxChars) +
    `\n\n[... RESULTADO TRUNCADO. Total de caracteres: ${text.length}. Use filtros mais específicos para reduzir o volume de dados.]`
  );
}
