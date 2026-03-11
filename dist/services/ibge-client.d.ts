export declare const IBGE_API: {
    readonly v1: "https://servicodados.ibge.gov.br/api/v1";
    readonly v2: "https://servicodados.ibge.gov.br/api/v2";
    readonly v3: "https://servicodados.ibge.gov.br/api/v3";
};
export declare class IBGEApiError extends Error {
    readonly status?: number | undefined;
    readonly endpoint?: string | undefined;
    constructor(message: string, status?: number | undefined, endpoint?: string | undefined);
}
export declare function ibgeFetch<T>(url: string, cacheTtl?: number): Promise<T>;
export declare function formatToolError(err: unknown): string;
export declare function truncateIfNeeded(text: string, maxChars?: number): string;
//# sourceMappingURL=ibge-client.d.ts.map