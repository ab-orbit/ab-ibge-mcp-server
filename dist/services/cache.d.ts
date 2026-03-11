declare class SimpleCache {
    private store;
    get<T>(key: string): T | null;
    set<T>(key: string, data: T, ttlMs: number): void;
    clear(): void;
    size(): number;
}
export declare const cache: SimpleCache;
export declare const TTL: {
    readonly LOCALIDADES: number;
    readonly NOMES: number;
    readonly SIDRA_METADATA: number;
    readonly SIDRA_DATA: number;
    readonly INDICADORES: number;
    readonly NOTICIAS: number;
};
export {};
//# sourceMappingURL=cache.d.ts.map