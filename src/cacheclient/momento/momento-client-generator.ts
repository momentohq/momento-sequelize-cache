import { CacheClient } from "@gomomento/sdk";
import {CacheClientProps, EagerCacheClientProps} from "@gomomento/sdk/dist/src/cache-client-props";
import {IClientGenerator} from "../client-generator";
import {MomentoClient} from "./momento-client";

const DEFAULT_CACHE_NAME = "model-cache";

export interface MomentoClientGeneratorProps extends EagerCacheClientProps {
    modelCacheName?: string;
    forceCreateCache?: boolean;
}

export class MomentoClientGenerator implements IClientGenerator {
    private static instance: MomentoClientGenerator | null = null;
    #client: MomentoClient | null = null;

    private constructor(private props: MomentoClientGeneratorProps) {}  // Make constructor private

    static getInstance(props: MomentoClientGeneratorProps): MomentoClientGenerator {
        if (this.instance === null) {
            this.instance = new MomentoClientGenerator(props);
        }
        return this.instance;
    }

    async getClient(): Promise<MomentoClient> {
        if (this.#client === null) {
            const cacheClient = await CacheClient.create(this.props);

            const cacheName = this.props?.modelCacheName ?? DEFAULT_CACHE_NAME;
            this.#client = new MomentoClient(cacheClient, cacheName);
            if (this.props?.forceCreateCache) {
                await this.#client.createCache(cacheName);
            }
        }
        return this.#client;
    }
}
