import {CacheClient, CacheGet, CacheSet, CreateCache} from '@gomomento/sdk';
import { ICacheClient } from '../cache-client';
import {LoggerManager} from "../../logger/logger-manager";

export class MomentoClient implements ICacheClient {

    constructor(private client: CacheClient) {}

    async get(tableName: string, cacheKey: string) {
        const log = LoggerManager.getLogger();
        const getResponse =  await this.client.get(tableName, cacheKey);

        if (getResponse instanceof CacheGet.Error) {
            log.error({cacheName: tableName}, `Error while retrieving from cache: ${getResponse.message()}`);
        } else if (getResponse instanceof CacheGet.Hit) {
            log.debug({cacheName: tableName, key: cacheKey}, `Cache hit!`);
        } else if (getResponse instanceof CacheGet.Miss) {
            log.debug({cacheName: tableName, key: cacheKey}, `Cache miss!`);
        }

        return getResponse;
    }

    async set(tableName: string, cacheKey: string, data: string, options?: { ttl: number }) {
        const log = LoggerManager.getLogger();

        const setResponse = await this.client.set(tableName, cacheKey, data, options);

        if (setResponse instanceof CacheSet.Error) {
            log.error({cacheName: tableName}, `Error while retrieving from cache: ${setResponse.message()}`);
        } else if (setResponse instanceof CacheSet.Success) {
            log.debug({cacheName: tableName, key: cacheKey}, `Successfully set the item to Momento!`)
        }

        return setResponse;
    }

    async createCache(cacheName: string) {
        const log = LoggerManager.getLogger();

        const createCache = await this.client.createCache(cacheName);

        if (createCache instanceof CreateCache.Error) {
            log.error({cacheName: cacheName}, `Error while creating cache: ${createCache.message()}`)
        } else if (createCache instanceof CreateCache.AlreadyExists) {
            log.debug({cacheName: cacheName}, `Cache already exists!`)
        } else if (createCache instanceof CreateCache.Success) {
            log.debug({cacheName: cacheName}, `Cache created successfully!`)
        }
    }
}
