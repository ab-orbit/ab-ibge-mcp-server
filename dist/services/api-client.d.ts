export declare const IBGE_BASES: {
    readonly v1: "https://servicodados.ibge.gov.br/api/v1";
    readonly v2: "https://servicodados.ibge.gov.br/api/v2";
    readonly v3: "https://servicodados.ibge.gov.br/api/v3";
};
export declare const CHARACTER_LIMIT = 50000;
export declare class IBGEApiError extends Error {
    readonly statusCode?: number | undefined;
    readonly endpoint?: string | undefined;
    constructor(message: string, statusCode?: number | undefined, endpoint?: string | undefined);
}
export declare function ibgeFetch<T>(url: string): Promise<T>;
export declare function truncateIfNeeded(text: string, limit?: number): string;
export declare function formatarNumero(valor: number | string | null | undefined): string;
export declare function mcpError(message: string): {
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
};
export declare function mcpSuccess(text: string): {
    content: {
        type: "text";
        text: string;
    }[];
};
//# sourceMappingURL=api-client.d.ts.map