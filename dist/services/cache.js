"use strict";
// services/cache.ts
// In-memory cache with TTL for IBGE API responses
Object.defineProperty(exports, "__esModule", { value: true });
exports.TTL = exports.cache = void 0;
class SimpleCache {
    store = new Map();
    get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.data;
    }
    set(key, data, ttlMs) {
        this.store.set(key, {
            data,
            expiresAt: Date.now() + ttlMs,
        });
    }
    clear() {
        this.store.clear();
    }
    size() {
        return this.store.size;
    }
}
exports.cache = new SimpleCache();
// TTL constants based on IBGE data update frequency
exports.TTL = {
    LOCALIDADES: 24 * 60 * 60 * 1000, // 24 hours - rarely changes
    NOMES: 7 * 24 * 60 * 60 * 1000, // 7 days - census data, never changes
    SIDRA_METADATA: 6 * 60 * 60 * 1000, // 6 hours
    SIDRA_DATA: 60 * 60 * 1000, // 1 hour - economic indicators update monthly
    INDICADORES: 60 * 60 * 1000, // 1 hour
    NOTICIAS: 30 * 60 * 1000, // 30 minutes
};
//# sourceMappingURL=cache.js.map