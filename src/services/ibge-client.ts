// services/ibge-client.ts
// Cliente HTTP centralizado para todas as APIs do IBGE

import { cache } from "./cache.js";

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

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(
  url: string,
  retries = 3,
  baseDelay = 500
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      clearTimeout(timeout);

      // Retry on 503/504 (server errors)
      if (response.status === 503 || response.status === 504) {
        if (attempt < retries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }
      }

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

      if (err instanceof IBGEApiError) {
        lastError = err;
        if (err.status !== 503 && err.status !== 504) {
          throw err; // Don't retry on non-retryable errors
        }
      } else if (err instanceof Error && err.name === "AbortError") {
        lastError = new IBGEApiError("Timeout: a API do IBGE demorou mais de 15s", undefined, url);
      } else {
        lastError = new IBGEApiError(
          `Erro ao conectar com a API do IBGE: ${err instanceof Error ? err.message : String(err)}`,
          undefined,
          url
        );
      }

      // If not last attempt and error is retryable, continue
      if (attempt < retries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError || new IBGEApiError("Erro desconhecido após retries", undefined, url);
}

export async function ibgeFetch<T>(url: string, cacheTtl?: number): Promise<T> {
  // Check cache first if TTL is provided
  if (cacheTtl !== undefined) {
    const cached = cache.get<T>(url);
    if (cached !== null) {
      return cached;
    }
  }

  // Fetch with retry
  const data = await fetchWithRetry<T>(url);

  // Store in cache if TTL is provided
  if (cacheTtl !== undefined) {
    cache.set(url, data, cacheTtl);
  }

  return data;
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
