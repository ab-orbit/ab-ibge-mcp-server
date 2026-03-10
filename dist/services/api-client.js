"use strict";
// Cliente HTTP centralizado para as APIs do IBGE
Object.defineProperty(exports, "__esModule", { value: true });
exports.IBGEApiError = exports.CHARACTER_LIMIT = exports.IBGE_BASES = void 0;
exports.ibgeFetch = ibgeFetch;
exports.truncateIfNeeded = truncateIfNeeded;
exports.formatarNumero = formatarNumero;
exports.mcpError = mcpError;
exports.mcpSuccess = mcpSuccess;
exports.IBGE_BASES = {
    v1: "https://servicodados.ibge.gov.br/api/v1",
    v2: "https://servicodados.ibge.gov.br/api/v2",
    v3: "https://servicodados.ibge.gov.br/api/v3",
};
exports.CHARACTER_LIMIT = 50_000;
class IBGEApiError extends Error {
    statusCode;
    endpoint;
    constructor(message, statusCode, endpoint) {
        super(message);
        this.statusCode = statusCode;
        this.endpoint = endpoint;
        this.name = "IBGEApiError";
    }
}
exports.IBGEApiError = IBGEApiError;
async function ibgeFetch(url) {
    let response;
    try {
        response = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15_000),
        });
    }
    catch (err) {
        if (err instanceof Error && err.name === "TimeoutError") {
            throw new IBGEApiError(`Timeout ao acessar a API do IBGE: ${url}`);
        }
        throw new IBGEApiError(`Erro de rede ao acessar: ${url}`);
    }
    if (!response.ok) {
        throw new IBGEApiError(`API do IBGE retornou erro ${response.status}: ${response.statusText}`, response.status, url);
    }
    try {
        return (await response.json());
    }
    catch {
        throw new IBGEApiError(`Resposta inválida (não é JSON) de: ${url}`);
    }
}
function truncateIfNeeded(text, limit = exports.CHARACTER_LIMIT) {
    if (text.length <= limit)
        return text;
    const truncated = text.slice(0, limit);
    return `${truncated}\n\n⚠️ Resposta truncada em ${limit} caracteres. Use filtros mais específicos para obter menos resultados.`;
}
function formatarNumero(valor) {
    if (valor === null || valor === undefined || valor === "")
        return "N/D";
    const num = typeof valor === "string" ? parseFloat(valor) : valor;
    if (isNaN(num))
        return String(valor);
    return num.toLocaleString("pt-BR");
}
function mcpError(message) {
    return {
        content: [{ type: "text", text: `❌ Erro: ${message}` }],
        isError: true,
    };
}
function mcpSuccess(text) {
    return {
        content: [{ type: "text", text: truncateIfNeeded(text) }],
    };
}
//# sourceMappingURL=api-client.js.map