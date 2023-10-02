import {CacheClient, CacheGet} from '@gomomento/sdk';
import { ICacheClient } from '../cache-client';
import {LoggerManager} from "../../logger/logger-manager";

export class MomentoClient implements ICacheClient {

    constructor(private client: CacheClient) {}

    async get(tableName: string, cacheKey: string) {
        const log = LoggerManager.getLogger();
        const getResponse =  await this.client.get(tableName, cacheKey);

        if (getResponse instanceof CacheGet.Error) {
            log.error({cacheName: tableName}, `Error while retrieving from cache: ${getResponse.message()}`);
        } else if (getResponse instanceof CacheGet.Miss) {
            log.debug({cacheName: tableName, key: cacheKey}, `Cache miss!`);
        }

        return getResponse;
    }

    async set(tableName: string, cacheKey: string, data: string, options?: { ttl: number }) {
        const log = LoggerManager.getLogger();

        const setResponse = await this.client.set(tableName, cacheKey, data, options);

        if (setResponse instanceof CacheGet.Error) {
            log.error({cacheName: tableName}, `Error while retrieving from cache: ${setResponse.message()}`);
        }

        return setResponse;
    }
}
