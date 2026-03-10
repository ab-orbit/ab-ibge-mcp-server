"use strict";
// services/ibge-client.ts
// Cliente HTTP centralizado para todas as APIs do IBGE
Object.defineProperty(exports, "__esModule", { value: true });
exports.IBGEApiError = exports.IBGE_API = void 0;
exports.ibgeFetch = ibgeFetch;
exports.formatToolError = formatToolError;
exports.truncateIfNeeded = truncateIfNeeded;
exports.IBGE_API = {
    v1: "https://servicodados.ibge.gov.br/api/v1",
    v2: "https://servicodados.ibge.gov.br/api/v2",
    v3: "https://servicodados.ibge.gov.br/api/v3",
};
class IBGEApiError extends Error {
    status;
    endpoint;
    constructor(message, status, endpoint) {
        super(message);
        this.status = status;
        this.endpoint = endpoint;
        this.name = "IBGEApiError";
    }
}
exports.IBGEApiError = IBGEApiError;
async function ibgeFetch(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
        });
        clearTimeout(timeout);
        if (!response.ok) {
            throw new IBGEApiError(`IBGE API retornou status ${response.status}: ${response.statusText}`, response.status, url);
        }
        const data = (await response.json());
        return data;
    }
    catch (err) {
        clearTimeout(timeout);
        if (err instanceof IBGEApiError)
            throw err;
        if (err instanceof Error && err.name === "AbortError") {
            throw new IBGEApiError("Timeout: a API do IBGE demorou mais de 15s", undefined, url);
        }
        throw new IBGEApiError(`Erro ao conectar com a API do IBGE: ${err instanceof Error ? err.message : String(err)}`, undefined, url);
    }
}
function formatToolError(err) {
    if (err instanceof IBGEApiError) {
        return `Erro na API do IBGE: ${err.message}${err.endpoint ? `\nEndpoint: ${err.endpoint}` : ""}`;
    }
    return `Erro inesperado: ${err instanceof Error ? err.message : String(err)}`;
}
function truncateIfNeeded(text, maxChars = 50000) {
    if (text.length <= maxChars)
        return text;
    return (text.slice(0, maxChars) +
        `\n\n[... RESULTADO TRUNCADO. Total de caracteres: ${text.length}. Use filtros mais específicos para reduzir o volume de dados.]`);
}
//# sourceMappingURL=ibge-client.js.map