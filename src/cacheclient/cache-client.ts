export interface ICacheClient {
    get(tableName: string, cacheKey: string): Promise<any>;
    set(tableName: string, cacheKey: string, data: string, options?: any): Promise<any>;

    createCache(cacheName: String): Promise<any>;
}
